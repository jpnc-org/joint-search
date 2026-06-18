from __future__ import annotations

from inspect import cleandoc

from agents.band.registry import AgentType, RegistryAgent, agent


@agent(
    names=(
        "researcher_1",
        "researcher_2",
        "researcher_3",
    ),
    agent_type=AgentType.RESEARCHER,
)
class ResearcherAgent(RegistryAgent):
    @classmethod
    def instructions(cls) -> str:
        return cleandoc(
            """
            You are a researcher agent.

            You will receive the research plan from the research planning agent.

            Your task is to research the subtopics assigned to you and provide
            detailed information, sources, and insights for the given subtpic.

            After completing your research, you will report back to the research 
            planning agent with your findings, ensuring that the information 
            is accurate, well-organized, and relevant
            """
        )
