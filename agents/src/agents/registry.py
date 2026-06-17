from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import yaml
from band.config import load_agent_config


@dataclass(frozen=True)
class AgentDefinition:
    name: str
    band_agent_id: str
    band_api_key: str

@dataclass
class AgentEntry:
    agent_definition: AgentDefinition
    agent_type: str | None = None
    is_running: bool = False

class Registry:
    def __init__(self) -> None:
        self._agent_registry: dict[str, AgentEntry] = {}

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


