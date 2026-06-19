from __future__ import annotations

from inspect import cleandoc

from agents.band.registry import AgentType, agent


@agent(
    names=(
        "researcher_1",
        "researcher_2",
        "researcher_3",
    ),
    agent_type=AgentType.RESEARCHER,
)
class ResearcherAgent:
    @classmethod
    def instructions(cls) -> str:
        return cleandoc(
            """
            You are a researcher agent.

            You will receive one research subtopic from research_planner.

            Your task is to research the subtopic assigned to you and provide
            detailed findings, sources, and relevant context. Distinguish
            confirmed facts from uncertainty, and state important limitations or
            missing evidence.

            After completing your research, report back to research_planner with
            concise, well-organized findings that can be synthesized into the
            final answer.
            """
        )
