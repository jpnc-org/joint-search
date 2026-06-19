from inspect import cleandoc

from agents.band.registry import AgentType, agent
from agents.research_request_completions import complete_research_request


@agent(names=("research_orchestrator",), agent_type=AgentType.ORCHESTRATOR)
class ResearchOrchestratorAgent:
    @classmethod
    def instructions(cls) -> str:
        return cleandoc(
            """
            You are the main research quality orchestrator.

            Receive the original research task. Your first action is to
            delegate topic decomposition to research_planner.

            After receiving the decomposition, you will receive research
            findings from the medior.

            Accept the output of medior as the final draft.

            When the answer is ready, first call send_final_answer_to_backend
            with the final answer, the backend request_id from the kickoff
            message, to complete the waiting backend request. Then publish the
            same final answer as a room-wide task event without mentioning
            anyone.
            """
        )

    @agent.tool
    def send_final_answer_to_backend(
        self,
        final_answer: str,
        request_id: str,
    ) -> str:
        """Complete the backend long-running research request.

        Args:
            final_answer: Final answer text for the waiting backend request.
            request_id: Backend request identifier from the kickoff message.
        """

        normalized_answer = final_answer.strip()
        if not normalized_answer:
            return "Error: final_answer must not be empty."

        normalized_request_id = request_id.strip()
        if not normalized_request_id:
            return "Error: request_id must not be empty."

        completion = complete_research_request(
            request_id=normalized_request_id,
            answer=normalized_answer,
            source="research_orchestrator",
        )

        return f"Final answer recorded for backend request '{completion.request_id}'."
