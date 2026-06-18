from __future__ import annotations

import asyncio
import logging

from dotenv import load_dotenv

from agents.band.registry import Registry

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def main() -> None:
    load_dotenv()
    registry = Registry()
    await registry.start_agents()


if __name__ == "__main__":
    asyncio.run(main())
