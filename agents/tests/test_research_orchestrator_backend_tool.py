from __future__ import annotations

import asyncio

from pytest import MonkeyPatch

from agents.definitions.research_orchestrator import ResearchOrchestratorAgent
from agents.research_request_completions import (
    clear_research_request_completions,
    get_research_request_completion,
    wait_for_research_request_completion,
)


def test_send_final_answer_rejects_empty_answer() -> None:
    result = ResearchOrchestratorAgent().send_final_answer_to_backend(
        " ",
        request_id="request-id",
    )

    assert "final_answer must not be empty" in result


def test_send_final_answer_rejects_empty_request_id() -> None:
    result = ResearchOrchestratorAgent().send_final_answer_to_backend(
        "Answer",
        request_id=" ",
    )

    assert "request_id must not be empty" in result


def test_send_final_answer_does_not_require_backend_callback_env(
    monkeypatch: MonkeyPatch,
) -> None:
    clear_research_request_completions()
    monkeypatch.delenv("BACKEND_FINAL_ANSWER_URL", raising=False)
    monkeypatch.delenv("BACKEND_API_TOKEN", raising=False)

    result = ResearchOrchestratorAgent().send_final_answer_to_backend(
        " Final answer. ",
        request_id=" request-id ",
    )

    completion = get_research_request_completion("request-id")
    assert result == "Final answer recorded for backend request 'request-id'."
    assert completion is not None
    assert completion.request_id == "request-id"
    assert completion.answer == "Final answer."
    assert completion.status == "completed"
    assert completion.source == "research_orchestrator"


def test_send_final_answer_completes_waiting_long_running_request() -> None:
    async def scenario() -> None:
        clear_research_request_completions()
        waiting_completion = asyncio.create_task(
            wait_for_research_request_completion("request-id")
        )

        await asyncio.sleep(0)
        result = ResearchOrchestratorAgent().send_final_answer_to_backend(
            "Final answer.",
            request_id="request-id",
        )
        completion = await waiting_completion

        assert result == "Final answer recorded for backend request 'request-id'."
        assert completion.request_id == "request-id"
        assert completion.answer == "Final answer."

    asyncio.run(scenario())
