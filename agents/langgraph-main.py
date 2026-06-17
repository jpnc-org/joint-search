import asyncio
import logging
import os
from dataclasses import dataclass

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import InMemorySaver

from band import Agent
from band.adapters import LangGraphAdapter
from band.config import load_agent_config

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MODEL_NAME = "deepseek/deepseek-v4-flash"


@dataclass(frozen=True)
class AgentSpec:
    config_key: str
    display_name: str
    instructions: str


def build_system_prompt(display_name: str, instructions: str) -> str:
    return render_system_prompt(
        agent_name=display_name,
        agent_description=instructions,
        include_base_instructions=False,
        # custom_section=instructions,
    )


async def run_agent(config_key: str, display_name: str, instructions: str) -> None:
    agent_id, api_key = load_agent_config(config_key)

    llm = ChatOpenAI(model=MODEL_NAME)
    adapter = LangGraphAdapter(
        llm=llm,
        checkpointer=InMemorySaver(),
        custom_section=build_system_prompt(display_name, instructions),
    )

    agent = Agent.create(
        adapter=adapter,
        agent_id=agent_id,
        api_key=api_key,
        ws_url=os.getenv("BAND_WS_URL"),
        rest_url=os.getenv("BAND_REST_URL"),
    )

    logger.info("Starting %s", config_key)
    await agent.run()


async def main() -> None:
    load_dotenv()

    agents = (
        AgentSpec(
            config_key="agent_a",
            display_name="Test Agent A",
            instructions=(
                "You are a very experienced developer, mostly working with the "
                "Python and C++ programming languages. You are very helpful and "
                "always provide detailed explanations."
            ),
        ),
        AgentSpec(
            config_key="agent_b",
            display_name="Test Agent B",
            instructions=(
                "You are a very experienced writer, mostly working with the "
                "English and Russian languages. You are a little bit rude, but "
                "still very helpful."
            ),
        ),
    )

    await asyncio.gather(
        *[
            run_agent(spec.config_key, spec.display_name, spec.instructions)
            for spec in agents
        ]
    )


if __name__ == "__main__":
    asyncio.run(main())
