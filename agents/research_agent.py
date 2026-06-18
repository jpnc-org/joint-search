import asyncio
import logging
import os

from dotenv import load_dotenv

from band import Agent
from band.adapters import PydanticAIAdapter
from band.config import load_agent_config
from websearch import perplexity_search

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Default LLM model configured for the project
MODEL_NAME = "openai-chat:deepseek/deepseek-v4-flash"

async def main() -> None:
    # Load environment variables from .env, overriding any existing shell variables
    load_dotenv(override=True)

    # Load the agent credentials from agent_config.yaml
    try:
        agent_id, agent_key = load_agent_config("research_agent")
    except Exception as e:
        logger.error(
            "Failed to load agent configuration for 'research_agent'. "
            "Please ensure agent_config.yaml is present and contains 'research_agent'. Error: %s",
            e
        )
        return

    # Initialize the Pydantic AI Adapter with our custom system prompt and the web search tool
    adapter = PydanticAIAdapter(
        model=MODEL_NAME,
        custom_section=(
            "You are a Deep Research Agent. You use the perplexity_search tool "
            "to retrieve real-time, high-quality information from the web to answer "
            "the user's questions in detail."
        ),
        additional_tools=[perplexity_search],
    )

    # Create the Band Agent using the adapter and credentials
    agent = Agent.create(
        adapter=adapter,
        agent_id=agent_id,
        api_key=agent_key,
        ws_url=os.getenv("BAND_WS_URL"),
        rest_url=os.getenv("BAND_REST_URL"),
    )

    logger.info("Starting Deep Research Agent...")
    await agent.run()

if __name__ == "__main__":
    asyncio.run(main())
