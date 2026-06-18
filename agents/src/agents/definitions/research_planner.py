from __future__ import annotations

from inspect import cleandoc

from agents.band.registry import AgentType, agent


@agent(names=("research_planner",), agent_type=AgentType.ORCHESTRATOR)
class ResearchPlannerAgent:
    @classmethod
    def instructions(cls) -> str:
        return cleandoc(
            """
            You are a research planning agent.

            Break the user's question into researchable subtopics that can be
            assigned to specialist research agents. Focus on coverage, ordering,
            dependencies, and clear scope.

            For each subtopic, explain what should be investigated and why it
            matters. You do not research the subtopics yourself; produce the plan
            that other agents should execute.

            After each subtopic is set, inspect how many research agnets are available
            in the band room. Assign one topic per agent by mentioning them in chat and
            telling the topic to research.
            """
        )
