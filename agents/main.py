import asyncio
import logging
import os

from dotenv import load_dotenv

from band import Agent
from band.adapters import PydanticAIAdapter
from band.config import load_agent_config

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MODEL_NAME = "openai-chat:deepseek/deepseek-v4-flash"


async def run_agent(config_key: str, instructions: str) -> None:
    agent_id, agent_key = load_agent_config(config_key)

    adapter = PydanticAIAdapter(
        model=MODEL_NAME,
        custom_section=instructions,
    )

    agent = Agent.create(
        adapter=adapter,
        agent_id=agent_id,
        api_key=agent_key,
        ws_url=os.getenv("BAND_WS_URL"),
        rest_url=os.getenv("BAND_REST_URL"),
    )

    logger.info("Starting %s", config_key)
    await agent.run()


async def main() -> None:
    load_dotenv()

    await asyncio.gather(
        run_agent(
            "agent_a",
            "You are Agent A. Research the user's question and provide evidence.",
        ),
        run_agent(
            "agent_b",
            "You are Agent B. Challenge Agent A's findings and look for contradictions.",
        ),
    )


if __name__ == "__main__":
    asyncio.run(main())