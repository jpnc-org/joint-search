from __future__ import annotations

import asyncio
import importlib
import logging

from dotenv import load_dotenv

from agents.band.registry import Registry, iter_agent_specs

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DEFAULT_AGENT_MODULES = ("agents.research_planner", "agents.researcher")


def load_default_agents() -> None:
    for module_name in DEFAULT_AGENT_MODULES:
        importlib.import_module(module_name)


async def main() -> None:
    load_dotenv()
    load_default_agents()
    registry = Registry()

    for spec in iter_agent_specs():
        logger.info("Starting %s", spec.name)
        registry.start_agent(
            spec.name,
            agent_type=spec.agent_type,
            system_instructions=spec.instructions,
        )

    if registry._agent_tasks:
        await asyncio.gather(*registry._agent_tasks.values())


if __name__ == "__main__":
    asyncio.run(main())
