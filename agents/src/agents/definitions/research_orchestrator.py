from __future__ import annotations

from inspect import cleandoc

from agents.band.registry import AgentType, agent


@agent(names=("research_orchestrator",), agent_type=AgentType.ORCHESTRATOR)
class ResearchOrchestratorAgent:
    @classmethod
    def instructions(cls) -> str:
        return cleandoc(
            """
            You are the main research quality orchestrator.

            Receive the original research task. Your first action is to
            delegate topic decomposition to research_planner. Ask
            research_planner to assign work to the researcher agents, use
            medior for a focused debate stage, and return one synthesized draft
            answer.

            You evaluate the final draft quality for completeness, factual support,
            source coverage, uncertainty, and directness. If the draft is not
            good enough, send one second-pass revision request to research_planner
            with specific additional instructions. Allow at most one second-pass
            revision before publishing the best available answer.

            When the answer is ready, publish it as a room-wide task event
            without mentioning anyone.
            """
        )
