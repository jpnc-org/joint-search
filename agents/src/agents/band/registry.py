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

DEFAULT_LANGGRAPH_MODEL = "alibaba/qwen3.7-plus"
_AGENT_TOOL_MARKER = "_agent_tool"
BAND_TOOL_CALL_INSTRUCTIONS = cleandoc(
    """
    Every visible Band response must be delivered by a Band tool call. Do not
    answer as a normal assistant message. Do not answer with a plain final text
    response because plain final text responses are not visible in the Band
    chat.

    Use band_send_message when addressing specific participants. In that tool
    call, set content to your full answer and set mentions to at least one
    relevant participant, usually the sender you are replying to.

    Use band_send_event with message_type set to task for room-wide progress or
    a final answer that should not mention anyone.

    If you need to think or use other tools first, still finish by calling
    either band_send_message or band_send_event so the result reaches the chat.
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
    """

    RESEARCHER = "RESEARCHER"
    GENERAL_PURPOSE = "GENERAL_PURPOSE"
    ORCHESTRATOR = "ORCHESTRATOR"


AGENT_TYPE_MODEL_NAMES: dict[AgentType, str] = {
    AgentType.RESEARCHER: DEFAULT_LANGGRAPH_MODEL,
    AgentType.GENERAL_PURPOSE: DEFAULT_LANGGRAPH_MODEL,
    AgentType.ORCHESTRATOR: DEFAULT_LANGGRAPH_MODEL,
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


def load_agent_definitions(
    agent_definitions_file_path: str | Path = ".",
) -> dict[str, AgentDefinition]:
    """Load configured Band agents from a YAML file or containing directory.

    Args:
        agent_definitions_file_path: Path to an ``agent_config.yaml`` file, or a
            directory containing that file. Defaults to the current working
            directory, then falls back to this ``agents`` project directory.

    Returns:
        Mapping from local agent name to normalized agent definition.

    Raises:
        ValueError: If the YAML file is not a mapping, an agent name is not a
            string, or an agent entry is not a mapping.
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

    return loaded_agents


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
            self.start_agent(
                spec.name,
                agent_type=spec.agent_type,
                system_instructions=spec.instructions,
                tools=list(spec.tools),
            )

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

        loaded_agents = load_agent_definitions(agent_definitions_file_path)

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
        llm = ChatOpenAI(model=model_name)
        adapter = LangGraphAdapter(
            llm=llm,
            checkpointer=InMemorySaver(),
            custom_section=build_agent_prompt(system_instructions),
            additional_tools=tools,
        )

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
