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
    RESEARCH = "RESEARCH"
    GENERAL_PURPOSE = "GENERAL_PURPOSE"


@dataclass(frozen=True)
class AgentDefinition:
    name: str
    band_agent_id: str
    band_api_key: str


@dataclass
class AgentEntry:
    agent_definition: AgentDefinition
    agent_type: AgentType = AgentType.GENERAL_PURPOSE


class Registry:
    def __init__(self) -> None:
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
