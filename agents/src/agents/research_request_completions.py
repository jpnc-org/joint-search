from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True, slots=True)
class ResearchRequestCompletion:
    """Final answer for a backend request currently waiting on agents."""

    request_id: str
    answer: str
    status: Literal["completed"] = "completed"
    source: str = "research_orchestrator"


_completed_research_requests: dict[str, ResearchRequestCompletion] = {}
_pending_research_requests: dict[str, asyncio.Future[ResearchRequestCompletion]] = {}


def complete_research_request(
    *,
    request_id: str,
    answer: str,
    source: str = "research_orchestrator",
) -> ResearchRequestCompletion:
    """Record the final answer for a backend request and release any waiter.

    The future agents API can wait on this in-process store while its HTTP
    request to the backend remains open. The orchestrator completes that
    request by calling its final-answer tool with the same `request_id`.
    """

    normalized_request_id = _normalize_non_empty(request_id, "request_id")
    normalized_answer = _normalize_non_empty(answer, "answer")
    normalized_source = _normalize_non_empty(source, "source")
    completion = ResearchRequestCompletion(
        request_id=normalized_request_id,
        answer=normalized_answer,
        source=normalized_source,
    )
    _completed_research_requests[normalized_request_id] = completion

    pending_request = _pending_research_requests.pop(normalized_request_id, None)
    if pending_request is not None and not pending_request.done():
        pending_request.set_result(completion)

    return completion


def get_research_request_completion(
    request_id: str,
) -> ResearchRequestCompletion | None:
    """Return a completed research request answer without removing it."""

    normalized_request_id = request_id.strip()
    if not normalized_request_id:
        return None

    return _completed_research_requests.get(normalized_request_id)


async def wait_for_research_request_completion(
    request_id: str,
    *,
    max_wait_seconds: float | None = None,
) -> ResearchRequestCompletion:
    """Wait for an agent tool call to complete a backend research request."""

    normalized_request_id = _normalize_non_empty(request_id, "request_id")
    existing_completion = _completed_research_requests.get(normalized_request_id)
    if existing_completion is not None:
        return existing_completion

    running_loop = asyncio.get_running_loop()
    pending_request = _pending_research_requests.get(normalized_request_id)
    if pending_request is None or pending_request.cancelled():
        pending_request = running_loop.create_future()
        _pending_research_requests[normalized_request_id] = pending_request

    if max_wait_seconds is None:
        return await pending_request

    async with asyncio.timeout(max_wait_seconds):
        return await asyncio.shield(pending_request)


def clear_research_request_completions() -> None:
    """Clear in-process completion state."""

    _completed_research_requests.clear()
    for pending_request in _pending_research_requests.values():
        if not pending_request.done():
            pending_request.cancel()
    _pending_research_requests.clear()


def _normalize_non_empty(value: str, field_name: str) -> str:
    normalized_value = value.strip()
    if not normalized_value:
        raise ValueError(f"{field_name} must not be empty.")
    return normalized_value
