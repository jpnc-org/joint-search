"""In-memory registry for starting configured Band agents as asyncio tasks.

The registry loads Band agent credentials from ``agent_config.yaml`` through the
Band SDK loader, then starts local LangGraph-backed agent loops with
``Agent.create(...).run()``. It tracks only local asyncio tasks for this Python
process; Band platform execution state is managed by Band itself.
"""

from __future__ import annotations

import asyncio
import logging
import os
from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path

import yaml
from band import Agent
from band.adapters import LangGraphAdapter
from band.config import load_agent_config
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import InMemorySaver

DEFAULT_LANGGRAPH_MODEL = "deepseek/deepseek-v4-flash"
logger = logging.getLogger(__name__)


class AgentType(StrEnum):
    """Domain category used to choose the agent's prompt/runtime behavior.

    Values:
        RESEARCH: Research-oriented agent behavior.
        GENERAL_PURPOSE: Default general assistant behavior.
    """

    RESEARCH = "RESEARCH"
    GENERAL_PURPOSE = "GENERAL_PURPOSE"


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

    def _load_agent_definitions(
        self,
        agent_definitions_file_path: str | Path = ".",
    ) -> dict[str, AgentDefinition]:
        """Load configured Band agents from a YAML file or containing directory.

        Args:
            agent_definitions_file_path: Path to an ``agent_config.yaml`` file,
                or a directory containing that file. Defaults to the current
                working directory.

        Returns:
            Mapping from local agent name to normalized agent definition.

        Raises:
            ValueError: If the YAML file is not a mapping, an agent name is not
                a string, or an agent entry is not a mapping.
        """

        agent_definitions_path = Path(agent_definitions_file_path)
        if agent_definitions_path.is_dir():
            agent_definitions_path = agent_definitions_path / "agent_config.yaml"

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
        model_name: str = DEFAULT_LANGGRAPH_MODEL,
        system_instructions: str = "",
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
            model_name: Chat model identifier passed to ``ChatOpenAI``.
            system_instructions: Additional instructions passed into the
                LangGraph adapter custom section.
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

        async def run_agent() -> None:
            logger.info("Starting agent task '%s'", name)

            llm = ChatOpenAI(model=model_name)
            adapter = LangGraphAdapter(
                llm=llm,
                checkpointer=InMemorySaver(),
                custom_section=system_instructions,
            )

            agent = Agent.create(
                adapter=adapter,
                agent_id=agent_definition.band_agent_id,
                api_key=agent_definition.band_api_key,
                ws_url=self._ws_url,
                rest_url=self._rest_url,
            )

            try:
                await agent.run(shutdown_timeout=shutdown_timeout)
            except Exception:
                logger.exception("Agent task '%s' failed", name)
                raise
            finally:
                if self._agent_tasks.get(name) is asyncio.current_task():
                    self._agent_tasks.pop(name)
                logger.info("Agent task '%s' stopped", name)

        task = asyncio.create_task(run_agent(), name=f"band-agent-{name}")
        task.add_done_callback(
            lambda completed_task: self._log_agent_task_result(name, completed_task)
        )
        self._agent_tasks[name] = task

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
