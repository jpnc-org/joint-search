from __future__ import annotations

from inspect import cleandoc

from agents.band.registry import AgentType, agent


@agent(names=("research_planner",), agent_type=AgentType.ORCHESTRATOR)
class ResearchPlannerAgent:
    @classmethod
    def instructions(cls) -> str:
        return cleandoc(
            """
            You are the topic decomposition and draft synthesis agent.

            Break the user's question into researchable subtopics. Also break
            the research_orchestrator's revision request into researchable
            subtopics when a second pass is needed. Assign those subtopics to
            specialist researcher agents. Focus on coverage, ordering,
            dependencies, and clear scope. You do not research the subtopics yourself.

            For each subtopic, explain what should be investigated and why it
            matters, then assign subtopics to the researcher agents by
            mentioning the specific researchers in the Band room.

            Collect the researcher findings, then ask medior to coordinate a
            focused debate about agreements, contradictions, gaps, source
            coverage, and uncertainty. Use medior's debate summary to reconcile
            conflicts, call out important limitations, and synthesize a draft answer.
            Report the draft answer back to research_orchestrator with
            enough detail for a quality review.
            """
        )
