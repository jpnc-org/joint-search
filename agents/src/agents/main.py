from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from typing import Protocol

from dotenv import load_dotenv

from agents.band.registry import DEFAULT_LANGGRAPH_MODEL, AgentType, Registry

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class AgentSpec:
    name: str
    agent_type: AgentType
    instructions: str


class AgentRegistry(Protocol):
    _agent_tasks: dict[str, asyncio.Task[None]]

    def start_agent(
        self,
        name: str,
        *,
        agent_type: AgentType = AgentType.GENERAL_PURPOSE,
        model_name: str = DEFAULT_LANGGRAPH_MODEL,
        system_instructions: str = "",
        shutdown_timeout: float | None = 30.0,
    ) -> None: ...


AGENT_A_INSTRUCTIONS = "You are a very experienced developer, mostly working with the Python and C++ programming languages. You are very helpful and always provide detailed explanations."  # noqa: E501
AGENT_B_INSTRUCTIONS = "You are a very experienced writer, mostly working with the English and Russian languages. You are very helpful and willing to assist."  # noqa: E501


AGENT_SPECS = (
    AgentSpec(
        name="agent_a",
        agent_type=AgentType.RESEARCH,
        instructions=AGENT_A_INSTRUCTIONS,
    ),
    AgentSpec(
        name="agent_b",
        agent_type=AgentType.GENERAL_PURPOSE,
        instructions=AGENT_B_INSTRUCTIONS,
    ),
)


async def run_agents(
    registry: AgentRegistry,
    *,
    specs: tuple[AgentSpec, ...] = AGENT_SPECS,
    model_name: str = DEFAULT_LANGGRAPH_MODEL,
    shutdown_timeout: float | None = 30.0,
    startup_delay_seconds: float = 0.75,
) -> None:
    for index, spec in enumerate(specs):
        if index > 0 and startup_delay_seconds > 0:
            await asyncio.sleep(startup_delay_seconds)

        logger.info("Starting %s", spec.name)
        registry.start_agent(
            spec.name,
            agent_type=spec.agent_type,
            model_name=model_name,
            system_instructions=spec.instructions,
            shutdown_timeout=shutdown_timeout,
        )

    if registry._agent_tasks:
        await asyncio.gather(*registry._agent_tasks.values())


async def main() -> None:
    load_dotenv()
    await run_agents(Registry())


if __name__ == "__main__":
    asyncio.run(main())
