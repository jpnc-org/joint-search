"""In-memory registry for starting configured Band agents as asyncio tasks.

The registry loads Band agent credentials from ``agent_config.yaml`` through the
Band SDK loader, then starts supervised local LangGraph-backed agent loops with
``Agent.create(...).run()``. It tracks only local asyncio tasks for this Python
process; Band platform execution state is managed by Band itself.
"""

from __future__ import annotations

import asyncio
import logging
import os
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from enum import StrEnum
from inspect import cleandoc
from pathlib import Path
from typing import Any, TypeVar

import yaml
from band import Agent
from band.adapters import LangGraphAdapter
from band.config import load_agent_config
from langchain_core.tools import BaseTool
from langchain_core.tools import tool as _langchain_tool
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import InMemorySaver

DEFAULT_LANGGRAPH_MODEL = "qwen-plus"
_AGENT_TOOL_MARKER = "_agent_tool"
BAND_TOOL_CALL_INSTRUCTIONS = cleandoc(
    """
    Every answer to a Band message must be delivered by a tool call named
    band_send_message. Do not answer as a normal assistant message. Do not
    answer with a plain final text response because those are not visible in the
    Band chat.

    In the tool call, set content to your full answer and set mentions to at
    least one relevant participant, usually the sender you are replying to.

    If you need to think or use other tools first, still finish by calling
    band_send_message.

    CRITICAL: You MUST call band_send_message EXACTLY ONCE per execution. Once you have called it to deliver your final answer, immediately terminate the run by returning a simple final text response like "Response sent." so the execution ends.
    """
)
AGENT_RECONNECT_BASE_DELAY_SECONDS = 2.0
AGENT_RECONNECT_MAX_DELAY_SECONDS = 60.0
AGENT_STOP_TIMEOUT_SECONDS = 2.0
AGENT_CONFIG_FILENAME = "agent_config.yaml"
DEFAULT_AGENT_CONFIG_PATH = Path(__file__).resolve().parents[3] / AGENT_CONFIG_FILENAME
logger = logging.getLogger(__name__)


def _patch_band_local_runtime(streaming_client: Any | None = None) -> None:
    """Patch Band websocket runtime so this process owns reconnect/shutdown."""

    if streaming_client is None:
        try:
            from band.client.streaming import client as streaming_client
        except Exception:
            logger.debug("Could not import Band streaming client", exc_info=True)
            return

    websocket_cls = getattr(streaming_client, "WebSocketClient", None)
    if websocket_cls is not None:
        current_aenter = getattr(websocket_cls, "__aenter__", None)
        if current_aenter is not None and not getattr(
            current_aenter,
            "_agents_no_auto_reconnect",
            False,
        ):

            async def _agents_aenter(self: Any) -> Any:
                result = await current_aenter(self)
                client = getattr(self, "client", None)
                if client is not None and hasattr(client, "auto_reconnect"):
                    client.auto_reconnect = False
                return result

            _agents_aenter._agents_no_auto_reconnect = True  # type: ignore[attr-defined]
            websocket_cls.__aenter__ = _agents_aenter

    phx_cls = getattr(streaming_client, "PHXChannelsClient", None)
    if phx_cls is not None:
        current_run_forever = getattr(phx_cls, "run_forever", None)
        if current_run_forever is not None and not getattr(
            current_run_forever,
            "_agents_no_signal_handlers",
            False,
        ):

            async def _agents_run_forever(self: Any) -> None:
                supervisor_task = getattr(self, "_supervisor_task", None)
                if supervisor_task is None:
                    raise RuntimeError("Client is not connected")
                await supervisor_task

            _agents_run_forever._agents_no_signal_handlers = True  # type: ignore[attr-defined]
            phx_cls.run_forever = _agents_run_forever


def _reconnect_delay_seconds(attempt: int) -> float:
    return min(
        AGENT_RECONNECT_BASE_DELAY_SECONDS * (2 ** min(max(attempt - 1, 0), 5)),
        AGENT_RECONNECT_MAX_DELAY_SECONDS,
    )


def _resolve_agent_definitions_path(agent_definitions_file_path: str | Path) -> Path:
    agent_definitions_path = Path(agent_definitions_file_path)

    if agent_definitions_path == Path("."):
        current_directory_config = Path.cwd() / AGENT_CONFIG_FILENAME
        if current_directory_config.is_file():
            return current_directory_config
        return DEFAULT_AGENT_CONFIG_PATH

    if agent_definitions_path.is_dir():
        return agent_definitions_path / AGENT_CONFIG_FILENAME

    return agent_definitions_path


def build_agent_prompt(system_instructions: str) -> str:
    """Build the registry-managed custom prompt section for Band agents."""

    role_instructions = system_instructions.strip()
    if not role_instructions:
        return BAND_TOOL_CALL_INSTRUCTIONS
    return f"{role_instructions}\n\n{BAND_TOOL_CALL_INSTRUCTIONS}"


class AgentType(StrEnum):
    """Domain category used to choose the agent's prompt/runtime behavior.

    Values:
        RESEARCHER: Researcher agent behavior.
        GENERAL_PURPOSE: Default general assistant behavior.
        ORCHESTRATOR: Agent behavior for coordinating other agents.
        COORDINATOR: Agent behavior for triggering debate and final synthesis.
    """

    RESEARCHER = "RESEARCHER"
    GENERAL_PURPOSE = "GENERAL_PURPOSE"
    ORCHESTRATOR = "ORCHESTRATOR"
    COORDINATOR = "COORDINATOR"


AGENT_TYPE_MODEL_NAMES: dict[AgentType, str] = {
    AgentType.RESEARCHER: DEFAULT_LANGGRAPH_MODEL,
    AgentType.GENERAL_PURPOSE: DEFAULT_LANGGRAPH_MODEL,
    AgentType.ORCHESTRATOR: DEFAULT_LANGGRAPH_MODEL,
    AgentType.COORDINATOR: DEFAULT_LANGGRAPH_MODEL,
}


def model_name_for_agent_type(agent_type: AgentType) -> str:
    """Return the default chat model for an agent behavior category."""

    return AGENT_TYPE_MODEL_NAMES[agent_type]


@dataclass(frozen=True)
class AgentSpec:
    """Role instructions and startup metadata for one local Band agent name.

    Attributes:
        name: Local registry key from ``agent_config.yaml``.
        agent_type: Domain behavior category passed into ``start_agent``.
        instructions: Role-specific prompt text. Band delivery instructions are
            appended later by ``build_agent_prompt``.
        tools: LangChain tools available to this agent.
    """

    name: str
    agent_type: AgentType
    instructions: str
    tools: tuple[Any, ...] = ()


_agent_specs: dict[str, AgentSpec] = {}


AgentClass = TypeVar("AgentClass", bound=type)


def _mark_agent_tool(tool_function: Any) -> Any:
    if isinstance(tool_function, (classmethod, staticmethod)):
        setattr(tool_function.__func__, _AGENT_TOOL_MARKER, True)
        return tool_function

    setattr(tool_function, _AGENT_TOOL_MARKER, True)
    return tool_function


class agent:
    """Register an agent class for one or more local agent names."""

    tool = staticmethod(_mark_agent_tool)

    def __new__(
        cls,
        *,
        names: Sequence[str],
        agent_type: AgentType,
    ) -> Callable[[AgentClass], AgentClass]:
        normalized_names = _normalize_agent_names(names)

        def decorator(agent_class: AgentClass) -> AgentClass:
            _register_agent_class(
                agent_class,
                names=normalized_names,
                agent_type=agent_type,
            )
            return agent_class

        return decorator


def iter_agent_specs() -> tuple[AgentSpec, ...]:
    """Return registered local agent startup specs in registration order."""

    return tuple(_agent_specs.values())


def _register_agent_class(
    agent_class: type[Any],
    *,
    names: tuple[str, ...],
    agent_type: AgentType,
) -> None:
    instructions = _load_agent_instructions(agent_class.instructions())
    tools = _load_agent_tools(agent_class)
    specs = tuple(
        AgentSpec(
            name=name,
            agent_type=agent_type,
            instructions=instructions,
            tools=tools,
        )
        for name in names
    )

    for spec in specs:
        if spec.name in _agent_specs:
            raise ValueError(f"Agent '{spec.name}' is already registered.")

    for spec in specs:
        _agent_specs[spec.name] = spec


def _load_agent_tools(agent_class: type[Any]) -> tuple[BaseTool, ...]:
    tools: list[BaseTool] = []
    instance: Any | None = None

    for name, value in vars(agent_class).items():
        if isinstance(value, BaseTool):
            tools.append(value)
            continue

        if not _is_marked_agent_tool(value):
            continue

        if isinstance(value, (classmethod, staticmethod)):
            tool_callable = getattr(agent_class, name)
        else:
            if instance is None:
                try:
                    instance = agent_class()
                except TypeError as exc:
                    raise ValueError(
                        "Agent classes with instance tools must be instantiable "
                        "without arguments."
                    ) from exc
            tool_callable = getattr(instance, name)

        tools.append(_langchain_tool(tool_callable))

    return tuple(tools)


def _is_marked_agent_tool(value: Any) -> bool:
    if isinstance(value, (classmethod, staticmethod)):
        return bool(getattr(value.__func__, _AGENT_TOOL_MARKER, False))

    return bool(getattr(value, _AGENT_TOOL_MARKER, False))


def _normalize_agent_names(names: Sequence[str]) -> tuple[str, ...]:
    if isinstance(names, str) or not names:
        raise ValueError("Agent names must include at least one name.")

    normalized_names: list[str] = []
    seen_names: set[str] = set()
    for raw_name in names:
        if not isinstance(raw_name, str):
            raise ValueError("Agent names must be strings.")

        name = raw_name.strip()
        if not name:
            raise ValueError("Agent names must be non-empty strings.")
        if name in seen_names:
            raise ValueError(f"Agent '{name}' is already registered.")

        normalized_names.append(name)
        seen_names.add(name)

    return tuple(normalized_names)


def _load_agent_instructions(raw_instructions: str) -> str:
    if not isinstance(raw_instructions, str):
        raise ValueError("Agent instructions must be a string.")

    instructions = raw_instructions.strip()
    if not instructions:
        raise ValueError("Agent instructions must not be empty.")

    return instructions


@dataclass(frozen=True)
class AgentDefinition:
    """Credentials and local name for a Band platform agent.

    Attributes:
        name: Local registry key from ``agent_config.yaml``.
        band_agent_id: Band platform agent ID.
        band_api_key: Band agent API key used to run this agent.
    """

    name: str
    band_agent_id: str
    band_api_key: str


@dataclass
class AgentEntry:
    """Registered agent plus mutable runtime metadata.

    Attributes:
        agent_definition: Static Band agent credentials and local name.
        agent_type: Current behavior category assigned for startup.
    """

    agent_definition: AgentDefinition
    agent_type: AgentType = AgentType.GENERAL_PURPOSE


class Registry:
    """Load Band agent definitions and start their local runtime tasks."""

    def __init__(self) -> None:
        """Create a registry using Band platform URLs from the environment.

        The constructor does not load ``.env`` itself. Entry points should call
        ``load_dotenv()`` before constructing the registry when local dotenv
        files are needed.

        Raises:
            ValueError: If ``BAND_WS_URL`` or ``BAND_REST_URL`` is not set.
        """

        import agents.definitions  # noqa: F401

        ws_url = os.getenv("BAND_WS_URL")
        if not ws_url:
            raise ValueError("BAND_WS_URL environment variable is not set.")

        rest_url = os.getenv("BAND_REST_URL")
        if not rest_url:
            raise ValueError("BAND_REST_URL environment variable is not set.")

        self._ws_url = ws_url
        self._rest_url = rest_url

        self._agent_registry: dict[str, AgentEntry] = {}
        self._agent_tasks: dict[str, asyncio.Task[None]] = {}

        self._load_agent_definitions()

    async def start_agents(self) -> None:
        """Start all registered agents and wait for them to complete."""

        for spec in iter_agent_specs():
            if spec.name not in self._agent_registry:
                logger.warning("Agent '%s' is defined in code but not configured in agent_config.yaml. Skipping.", spec.name)
                continue
            self.start_agent(
                spec.name,
                agent_type=spec.agent_type,
                system_instructions=spec.instructions,
                tools=list(spec.tools),
            )

        if not self._agent_tasks:
            logger.warning("No agents were started.")
            return

        await asyncio.gather(*self._agent_tasks.values())

    def _load_agent_definitions(
        self,
        agent_definitions_file_path: str | Path = ".",
    ) -> dict[str, AgentDefinition]:
        """Load configured Band agents from a YAML file or containing directory.

        Args:
            agent_definitions_file_path: Path to an ``agent_config.yaml`` file,
                or a directory containing that file. Defaults to the current
                working directory, then falls back to this ``agents`` project
                directory.

        Returns:
            Mapping from local agent name to normalized agent definition.

        Raises:
            ValueError: If the YAML file is not a mapping, an agent name is not
                a string, or an agent entry is not a mapping.
        """

        agent_definitions_path = _resolve_agent_definitions_path(
            agent_definitions_file_path
        )

        with agent_definitions_path.open(encoding="utf-8") as file:
            raw_config = yaml.safe_load(file) or {}

        if not isinstance(raw_config, dict):
            raise ValueError("Agent definitions file must contain a YAML mapping.")

        loaded_agents: dict[str, AgentDefinition] = {}

        for raw_name, raw_definition in raw_config.items():
            if not isinstance(raw_name, str):
                raise ValueError("Agent definition names must be strings.")
            if not isinstance(raw_definition, dict):
                raise ValueError(f"Agent '{raw_name}' must be a YAML mapping.")

            agent_id, api_key = load_agent_config(
                raw_name,
                config_path=agent_definitions_path,
            )

            loaded_agents[raw_name] = AgentDefinition(
                name=raw_name,
                band_agent_id=agent_id,
                band_api_key=api_key,
            )

        self._agent_registry = {
            name: AgentEntry(agent_definition=definition)
            for name, definition in loaded_agents.items()
        }

        return loaded_agents

    def start_agent(
        self,
        name: str,
        *,
        agent_type: AgentType = AgentType.GENERAL_PURPOSE,
        model_name: str | None = None,
        system_instructions: str = "",
        tools: list[Any] | None = None,
        shutdown_timeout: float | None = 30.0,
    ) -> None:
        """Start one registered agent in the background.

        The task is stored by local agent name in ``_agent_tasks``. Attempting to
        start the same agent while its previous task is still running raises a
        ``RuntimeError``.

        Args:
            name: Local agent name loaded from ``agent_config.yaml``.
            agent_type: Domain behavior category to attach to the registry
                entry.
            model_name: Optional chat model override. When omitted, the model is
                selected from ``agent_type``.
            system_instructions: Additional instructions passed into the
                LangGraph adapter custom section.
            tools: Optional list of LangChain tools to make available to the
                agent.
            shutdown_timeout: Timeout passed through to ``Agent.run`` when the
                task shuts down.

        Raises:
            ValueError: If ``name`` is not registered.
            RuntimeError: If the agent already has a running local task.
        """

        entry = self._agent_registry.get(name)
        if entry is None:
            raise ValueError(f"Agent '{name}' is not registered.")

        existing_task = self._agent_tasks.get(name)
        if existing_task is not None and not existing_task.done():
            raise RuntimeError(f"Agent '{name}' is already running.")
        if existing_task is not None:
            self._agent_tasks.pop(name)

        agent_definition = entry.agent_definition
        entry.agent_type = agent_type
        resolved_model_name = (
            model_name
            if model_name is not None
            else model_name_for_agent_type(agent_type)
        )
        _patch_band_local_runtime()

        async def run_agent_forever() -> None:
            logger.info("Starting agent task '%s'", name)
            attempt = 0

            try:
                while True:
                    attempt += 1
                    agent = self._create_agent(
                        agent_definition=agent_definition,
                        model_name=resolved_model_name,
                        system_instructions=system_instructions,
                        tools=tools,
                    )
                    try:
                        await agent.run(shutdown_timeout=shutdown_timeout)
                    except asyncio.CancelledError:
                        raise
                    except Exception:
                        logger.exception(
                            "Agent task '%s' failed; reconnecting (attempt %d)",
                            name,
                            attempt,
                        )
                    else:
                        logger.warning(
                            "Agent task '%s' exited cleanly; reconnecting (attempt %d)",
                            name,
                            attempt,
                        )
                    finally:
                        await self._safe_stop_agent(name, agent)

                    await asyncio.sleep(_reconnect_delay_seconds(attempt))
            except asyncio.CancelledError:
                raise
            finally:
                if self._agent_tasks.get(name) is asyncio.current_task():
                    self._agent_tasks.pop(name)
                logger.info("Agent task '%s' stopped", name)

        task = asyncio.create_task(run_agent_forever(), name=f"band-agent-{name}")
        task.add_done_callback(
            lambda completed_task: self._log_agent_task_result(name, completed_task)
        )
        self._agent_tasks[name] = task

    def _create_agent(
        self,
        *,
        agent_definition: AgentDefinition,
        model_name: str,
        system_instructions: str,
        tools: list[Any] | None = None,
    ) -> Any:
        api_key = os.getenv("OPENAI_API_KEY")
        base_url = os.getenv("OPENAI_BASE_URL")
        logger.info(
            "Creating ChatOpenAI model '%s' with base_url=%s, api_key_prefix=%s",
            model_name,
            base_url,
            api_key[:6] if api_key else None,
        )
        llm = ChatOpenAI(
            model=model_name,
            api_key=api_key,
            base_url=base_url,
        )
        adapter = LangGraphAdapter(
            llm=llm,
            checkpointer=InMemorySaver(),
            custom_section=build_agent_prompt(system_instructions),
            additional_tools=tools,
        )

        # Dynamically inject the shared history context on_message method
        import types
        adapter.agent_id = agent_definition.band_agent_id
        adapter.id_to_reg_name = {
            entry.agent_definition.band_agent_id: name
            for name, entry in self._agent_registry.items()
        }
        adapter.on_message = types.MethodType(shared_context_on_message, adapter)

        return Agent.create(
            adapter=adapter,
            agent_id=agent_definition.band_agent_id,
            api_key=agent_definition.band_api_key,
            ws_url=self._ws_url,
            rest_url=self._rest_url,
        )

    async def _safe_stop_agent(self, name: str, agent: Any) -> None:
        stop = getattr(agent, "stop", None)
        if stop is None:
            return

        try:
            await stop(timeout=AGENT_STOP_TIMEOUT_SECONDS)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.debug("Agent task '%s' stop failed", name, exc_info=True)

    def _log_agent_task_result(
        self,
        name: str,
        task: asyncio.Task[None],
    ) -> None:
        if task.cancelled():
            logger.warning("Agent task '%s' cancelled", name)
            return

        exception = task.exception()
        if exception is not None:
            logger.error(
                "Agent task '%s' exited with error",
                name,
                exc_info=(type(exception), exception, exception.__traceback__),
            )
            return

        logger.info("Agent task '%s' completed", name)


async def shared_context_on_message(
    self: Any,
    msg: Any,
    tools: Any,
    history: Any,
    participants_msg: str | None,
    contacts_msg: str | None,
    *,
    is_session_bootstrap: bool,
    room_id: str,
) -> None:
    # 1. Resolve display name mappings & participant lists first
    participants_dicts = []
    try:
        participants = await tools.get_participants()
        if isinstance(participants, list):
            for p in participants:
                if hasattr(p, "dict"):
                    participants_dicts.append(p.dict())
                elif hasattr(p, "model_dump"):
                    participants_dicts.append(p.model_dump())
                elif isinstance(p, dict):
                    participants_dicts.append(p)
                else:
                    participants_dicts.append({
                        "id": getattr(p, "id", None),
                        "handle": getattr(p, "handle", None),
                        "name": getattr(p, "name", None),
                        "type": getattr(p, "type", None),
                    })
    except Exception as e:
        logger.warning("Failed to resolve participants: %s", e)

    id_to_name = {p["id"]: p["name"] for p in participants_dicts}

    # Static fallbacks for names and handles in case of bootstrap sync latency
    STATIC_ID_TO_NAME = {
        "6c152b48-4fe7-42eb-9af8-0fe4bc466308": "Orchestrator",
        "71726d0d-0ebb-4d33-ab26-454ffb5e8b16": "Medior",
        "6b87ef32-9d5e-4c3d-97d8-eb9871d32d70": "testagent",
        "0251c040-ee51-4a7b-a2e9-8c2c3adef2a8": "Agent2",
        "11ed0117-d350-420e-b51c-d58c072c2395": "Agent 3"
    }
    STATIC_ID_TO_HANDLE = {
        "71726d0d-0ebb-4d33-ab26-454ffb5e8b16": "abdulazizgajnazarov/medior",
        "6b87ef32-9d5e-4c3d-97d8-eb9871d32d70": "abdulazizgajnazarov/testagent",
        "0251c040-ee51-4a7b-a2e9-8c2c3adef2a8": "abdulazizgajnazarov/agent2",
        "11ed0117-d350-420e-b51c-d58c072c2395": "abdulazizgajnazarov/agent-3",
        "6c152b48-4fe7-42eb-9af8-0fe4bc466308": "abdulazizgajnazarov/research_planner"
    }

    # Merge static fallback name mappings if not present
    for uid, sname in STATIC_ID_TO_NAME.items():
        if uid not in id_to_name:
            id_to_name[uid] = sname

    # Synthesize participants in participants_dicts if missing or empty
    existing_p_ids = {p.get("id") for p in participants_dicts if p.get("id")}
    for uid, sname in STATIC_ID_TO_NAME.items():
        if uid not in existing_p_ids:
            participants_dicts.append({
                "id": uid,
                "handle": STATIC_ID_TO_HANDLE.get(uid),
                "name": sname,
                "type": "Agent" if uid != "6c152b48-4fe7-42eb-9af8-0fe4bc466308" else "User"
            })

    # Resolve UUID mentions in the incoming msg
    from band.runtime.formatters import replace_uuid_mentions
    import dataclasses
    try:
        content_resolved = replace_uuid_mentions(msg.content, participants_dicts)
        msg = dataclasses.replace(msg, content=content_resolved)
    except Exception as e:
        logger.warning("Failed to resolve UUID mentions in msg: %s", e)

    # 2. Fetch fresh room context directly from API
    try:
        res = await tools.fetch_room_context(room_id=room_id, page_size=100)
        raw_msgs = res.get("data", [])
    except Exception as e:
        logger.warning("Failed to fetch fresh room context: %s", e)
        raw_msgs = []

    # 3. Extract parsed messages from raw context, resolving UUID mentions
    parsed_msgs = []
    for item in raw_msgs:
        msg_type = item.get("message_type")
        if msg_type == "text":
            sender = item.get("sender_name")
            content = item.get("content", "")
            if participants_dicts:
                content = replace_uuid_mentions(content, participants_dicts)
            parsed_msgs.append({"sender": sender, "content": content})

    current_agent_name = id_to_name.get(self.agent_id, getattr(self, "agent_name", "Assistant"))

    # Ensure current message is in parsed_msgs
    if msg and not any(m.get("content") == msg.content for m in parsed_msgs):
        sender = id_to_name.get(msg.sender_id, msg.sender_name or msg.sender_type)
        parsed_msgs.append({"sender": sender, "content": msg.content})

    # Build a participant identity mapping message to help planner/agents identify roles
    identity_mapping = ["Here is the identity mapping for all agents in this chat room:"]
    id_to_reg_name = getattr(self, "id_to_reg_name", {})
    from agents.band.registry import _agent_specs, AgentType
    for p in participants_dicts:
        p_id = p.get("id")
        p_handle = p.get("handle")
        p_name = id_to_name.get(p_id, p.get("name", ""))
        reg_name = id_to_reg_name.get(p_id)
        if reg_name and p_handle:
            spec = _agent_specs.get(reg_name)
            if spec:
                role_desc = ""
                if spec.agent_type == AgentType.ORCHESTRATOR:
                    role_desc = "Orchestrator (Planner)"
                elif spec.agent_type == AgentType.RESEARCHER:
                    role_desc = f"Specialist Researcher ({reg_name})"
                elif spec.agent_type == AgentType.COORDINATOR:
                    role_desc = "Medior (Coordinator)"
                identity_mapping.append(f"- @{p_handle} ({p_name}): {role_desc}")
    identity_mapping_str = "\n".join(identity_mapping) if len(identity_mapping) > 1 else ""

    # 4. Gating and Stage Instruction Injection Logic
    from agents.band.registry import _agent_specs, AgentType
    planner_names = [name for name, spec in _agent_specs.items() if spec.agent_type == AgentType.ORCHESTRATOR]
    researcher_names = [name for name, spec in _agent_specs.items() if spec.agent_type == AgentType.RESEARCHER]
    coordinator_names = [name for name, spec in _agent_specs.items() if spec.agent_type == AgentType.COORDINATOR]

    # Map participant display names to their spec type lists
    planner_display_names = []
    researcher_display_names = []
    coordinator_display_names = []

    all_agent_ids = set(id_to_reg_name.keys()) | set(STATIC_ID_TO_NAME.keys())
    for p_id in all_agent_ids:
        p_name = id_to_name.get(p_id)
        if not p_name:
            continue
        reg_name = id_to_reg_name.get(p_id)
        if not reg_name:
            # Fallback reg_name from static mapping if not in registry
            if p_id == "6c152b48-4fe7-42eb-9af8-0fe4bc466308":
                reg_name = "research_planner"
            elif p_id == "71726d0d-0ebb-4d33-ab26-454ffb5e8b16":
                reg_name = "medior"
            elif p_id == "6b87ef32-9d5e-4c3d-97d8-eb9871d32d70":
                reg_name = "researcher_1"
            elif p_id == "0251c040-ee51-4a7b-a2e9-8c2c3adef2a8":
                reg_name = "researcher_2"
            elif p_id == "11ed0117-d350-420e-b51c-d58c072c2395":
                reg_name = "researcher_3"

        if reg_name:
            if reg_name in planner_names:
                if p_name not in planner_display_names:
                    planner_display_names.append(p_name)
            elif reg_name in researcher_names:
                if p_name not in researcher_display_names:
                    researcher_display_names.append(p_name)
            elif reg_name in coordinator_names:
                if p_name not in coordinator_display_names:
                    coordinator_display_names.append(p_name)

    # Fallback to config keys if participant list is empty or names unresolved
    if not planner_display_names:
        planner_display_names = planner_names
    if not researcher_display_names:
        researcher_display_names = researcher_names
    if not coordinator_display_names:
        coordinator_display_names = coordinator_names

    stage_instruction = ""
    
    # Resolve handles for stage prompt rendering
    medior_handle = ""
    researcher_handles_list = []
    for p in participants_dicts:
        p_id = p.get("id")
        p_handle = p.get("handle")
        if not p_handle:
            continue
        p_name = id_to_name.get(p_id, p.get("name", ""))
        if p_name in coordinator_display_names:
            medior_handle = f"@{p_handle}"
        elif p_name in researcher_display_names:
            researcher_handles_list.append(f"@{p_handle}")
    active_researcher_handles = ", ".join(researcher_handles_list)

    # 4a. Compute session boundary: find the index of the last user message
    last_user_msg_idx = max(
        (i for i, m in enumerate(parsed_msgs) 
         if m["sender"] not in planner_display_names 
         and m["sender"] not in researcher_display_names 
         and m["sender"] not in coordinator_display_names 
         and m["sender"] != "System"),
        default=-1
    )

    # Find first Medior message in the current session (after last user message)
    medior_first_msg_idx = next(
        (i for i, m in enumerate(parsed_msgs) 
         if i > last_user_msg_idx and m["sender"] in coordinator_display_names),
        None
    )

    final_synthesis_posted = False
    if medior_first_msg_idx is not None:
        # Check if all researchers have debated in the current session
        all_debated = True
        for r_name in researcher_display_names:
            r_deb = [
                m for m in parsed_msgs[medior_first_msg_idx + 1:] 
                if m["sender"] == r_name
            ]
            if not r_deb:
                all_debated = False
                break
        if all_debated:
            # Find the last debate message index from researchers in the current session
            last_deb_idx = max(
                (i for i, m in enumerate(parsed_msgs) 
                 if i > medior_first_msg_idx and m["sender"] in researcher_display_names),
                default=-1
            )
            # If coordinator posted after last_deb_idx, then final synthesis is posted
            if last_deb_idx != -1 and any(
                m["sender"] in coordinator_display_names 
                for m in parsed_msgs[last_deb_idx + 1:]
            ):
                final_synthesis_posted = True

    if final_synthesis_posted:
        logger.info("Pipeline Gating (%s): SILENT. Final synthesis has already been posted.", current_agent_name)
        return

    if current_agent_name in planner_display_names:
        planner_msgs = [
            m for m in parsed_msgs[last_user_msg_idx + 1:] 
            if m["sender"] == current_agent_name
        ]
        if planner_msgs:
            logger.info("Planner Gating (%s): SILENT. Plan already posted.", current_agent_name)
            return
        logger.info("Planner Gating (%s): ACTIVE. Creating plan.", current_agent_name)
        
    elif current_agent_name in researcher_display_names:
        my_msgs = [
            m for m in parsed_msgs[last_user_msg_idx + 1:] 
            if m["sender"] == current_agent_name
        ]
        if not my_msgs:
            # Check if planner has posted a topic assignment
            planner_posted = any(
                m["sender"] in planner_display_names 
                for m in parsed_msgs[last_user_msg_idx + 1:]
            )
            if planner_posted:
                logger.info("Researcher Gating (%s): ACTIVE. Running initial search.", current_agent_name)
                stage_instruction = (
                    "ACTIVE WORKFLOW STAGE: INITIAL SEARCH\n\n"
                    "You must perform a web search on the subtopic assigned to you by the planner using the 'perplexity_search' tool. "
                    f"Summarize your findings and post them using 'band_send_message', mentioning the Coordinator (medior) handle ({medior_handle}).\n\n"
                    "CRITICAL RATE LIMIT RULE: To respect API rate limits, you MUST limit yourself to a maximum of 1 or 2 high-quality web searches total using the 'perplexity_search' tool. Choose your search queries carefully and do NOT make excessive search calls."
                )
            else:
                logger.info("Researcher Gating (%s): SILENT. Waiting for planner topic assignment.", current_agent_name)
                return
        else:
            # Already posted initial search. Has coordinator triggered debate?
            if medior_first_msg_idx is not None:
                # Count my debate messages after the coordinator's last message
                my_debate_msgs = [
                    m for m in parsed_msgs[medior_first_msg_idx + 1:] 
                    if m["sender"] == current_agent_name
                ]
                if not my_debate_msgs:
                    logger.info("Researcher Gating (%s): ACTIVE. Running debate contribution.", current_agent_name)
                    stage_instruction = (
                        "ACTIVE WORKFLOW STAGE: DEBATE\n\n"
                        "The coordinator has triggered the debate. "
                        "You must read the other researchers' findings in the chat history, and post a message comparing your findings with theirs, pointing out agreements, disagreements, gaps, or confirmations. "
                        f"You MUST mention both the Coordinator (medior) handle ({medior_handle}) and the other Research Agents by their handles ({active_researcher_handles}) in your message. Mentioning medior is critical to wake him up for the final synthesis."
                    )
                else:
                    logger.info("Researcher Gating (%s): SILENT. Already participated in debate.", current_agent_name)
                    return
            else:
                logger.info("Researcher Gating (%s): SILENT. Waiting for coordinator debate trigger.", current_agent_name)
                return
                
    elif current_agent_name in coordinator_display_names:
        # Check if all researchers have posted initial findings in current session
        all_researchers_posted_initial = True
        missing_initial_researchers = []
        for r_name in researcher_display_names:
            r_msgs = [
                m for m in parsed_msgs[last_user_msg_idx + 1:] 
                if m["sender"] == r_name
            ]
            if not r_msgs:
                all_researchers_posted_initial = False
                missing_initial_researchers.append(r_name)
        
        if not all_researchers_posted_initial:
            logger.info("Coordinator Gating (%s): SILENT. Waiting for researchers %s to post initial findings.", current_agent_name, missing_initial_researchers)
            return
 
        if medior_first_msg_idx is None:
            logger.info("Coordinator Gating (%s): ACTIVE. Triggering debate.", current_agent_name)
            stage_instruction = (
                "ACTIVE WORKFLOW STAGE: DEBATE TRIGGER\n\n"
                "All Research Agents have posted their initial search findings. "
                "Your task in this turn is to trigger the debate among them. "
                "You MUST read their initial findings, identify the main agreements, contradictions, or gaps in their research, "
                f"and post a message asking the Research Agents to compare their findings and debate those specific points. "
                f"You MUST mention all active Research Agents by their handles: {active_researcher_handles}.\n\n"
                "CRITICAL: Do NOT write the final answer yourself yet. Focus on highlighting what they should compare and debate."
            )
        else:
            all_researchers_debated = True
            missing_debate_researchers = []
            for r_name in researcher_display_names:
                r_debate_msgs = [
                    m for m in parsed_msgs[medior_first_msg_idx + 1:]
                    if m["sender"] == r_name
                ]
                if not r_debate_msgs:
                    all_researchers_debated = False
                    missing_debate_researchers.append(r_name)
            
            if not all_researchers_debated:
                logger.info("Coordinator Gating (%s): SILENT. Waiting for researchers %s to participate in debate.", current_agent_name, missing_debate_researchers)
                return
            
            logger.info("Coordinator Gating (%s): ACTIVE. Ready to synthesize.", current_agent_name)
            human_handle = ""
            for p in participants_dicts:
                if p.get("type") == "User":
                    human_handle = f"@{p.get('handle')}"
                    break
            if not human_handle:
                human_handle = "@User"
 
            stage_instruction = (
                "ACTIVE WORKFLOW STAGE: FINAL SYNTHESIS\n\n"
                "The debate phase is complete. "
                "Your ONLY task in this turn is to synthesize all findings and debate points into a single, comprehensive, and well-structured final answer. "
                f"Address and mention the human user ({human_handle}) who asked the question. "
                "Do NOT ask the researchers to debate anymore. Summarize and synthesize the consensus and differences."
            )

    # 5. Build message list for LLM
    messages = []
    if self._inject_system_prompt and self._system_prompt:
        messages.append(("system", self._system_prompt))
        
    if identity_mapping_str:
        messages.append(("system", identity_mapping_str))
        
    # Reconstruct room history except current message
    history_pms = parsed_msgs[:-1] if parsed_msgs and parsed_msgs[-1]["content"] == msg.content else parsed_msgs
    for pm in history_pms:
        sender = pm["sender"]
        content = pm["content"]
        if sender == current_agent_name:
            messages.append(("assistant", content))
        else:
            messages.append(("user", f"[{sender}]: {content}"))

    if participants_msg:
        messages.append(("user", f"[System]: {participants_msg}"))

    if contacts_msg:
        messages.append(("user", f"[System]: {contacts_msg}"))

    if stage_instruction:
        messages.append(("system", stage_instruction))

    messages.append(("user", msg.format_for_llm()))
    graph_input = {"messages": messages}

    # 6. Execute with unique thread_id
    import uuid
    run_thread_id = f"{room_id}_{uuid.uuid4()}"
    
    from band.integrations.langgraph.langchain_tools import agent_tools_to_langchain
    langchain_tools = agent_tools_to_langchain(tools, features=self.features) + self.additional_tools

    if self.graph_factory:
        graph = self.graph_factory(langchain_tools)
    else:
        graph = self._static_graph

    if not graph:
        raise RuntimeError("No graph available")

    # Save checkpointer if needed
    checkpointer = getattr(graph, "checkpointer", None) or self._simple_checkpointer
    if checkpointer is not None:
        self._room_checkpointers[room_id] = checkpointer

    await graph.ainvoke(
        graph_input,
        config={
            "configurable": {
                "thread_id": run_thread_id,
                },
            "recursion_limit": self.recursion_limit,
        },
    )

    if is_session_bootstrap and room_id not in self._bootstrapped_rooms:
        self._bootstrapped_rooms[room_id] = None
