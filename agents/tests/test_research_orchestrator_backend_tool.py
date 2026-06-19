from __future__ import annotations

import json
from typing import Any, cast
from urllib.request import Request

from pytest import MonkeyPatch

import agents.definitions.research_orchestrator as orchestrator_module
from agents.definitions.research_orchestrator import ResearchOrchestratorAgent


class FakeResponse:
    def __init__(self, *, status: int, body: dict[str, Any] | str) -> None:
        self.status = status
        self.body = body

    def __enter__(self) -> FakeResponse:
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def read(self) -> bytes:
        if isinstance(self.body, str):
            return self.body.encode()
        return json.dumps(self.body).encode()


def test_send_final_answer_rejects_empty_answer(monkeypatch: MonkeyPatch) -> None:
    monkeypatch.setenv(
        "BACKEND_FINAL_ANSWER_URL",
        "https://backend.example.test/api/final-answer",
    )

    result = ResearchOrchestratorAgent().send_final_answer_to_backend(" ")

    assert "final_answer must not be empty" in result


def test_send_final_answer_rejects_missing_backend_url(
    monkeypatch: MonkeyPatch,
) -> None:
    monkeypatch.delenv("BACKEND_FINAL_ANSWER_URL", raising=False)

    result = ResearchOrchestratorAgent().send_final_answer_to_backend("Answer")

    assert "BACKEND_FINAL_ANSWER_URL" in result
    assert "not configured" in result


def test_send_final_answer_posts_to_backend(monkeypatch: MonkeyPatch) -> None:
    captured: dict[str, Any] = {}

    def fake_urlopen(request: Request, *, timeout: int) -> FakeResponse:
        captured["url"] = request.full_url
        captured["headers"] = request.headers
        request_data = cast(bytes, request.data or b"")
        captured["payload"] = json.loads(request_data.decode())
        captured["timeout"] = timeout
        return FakeResponse(status=201, body={"messageId": "message-id"})

    monkeypatch.setenv(
        "BACKEND_FINAL_ANSWER_URL",
        "https://backend.example.test/api/final-answer",
    )
    monkeypatch.setenv("BACKEND_API_TOKEN", "backend-token")
    monkeypatch.setattr(orchestrator_module, "urlopen", fake_urlopen)

    result = ResearchOrchestratorAgent().send_final_answer_to_backend(
        " Final answer. ",
        conversation_id=" conversation-id ",
        room_id=" room-id ",
    )

    assert result == "Final answer sent to backend. Message ID: message-id"
    assert captured["url"] == "https://backend.example.test/api/final-answer"
    assert captured["headers"]["Authorization"] == "Bearer backend-token"
    assert captured["headers"]["Content-type"] == "application/json"
    assert captured["timeout"] == 30
    assert captured["payload"] == {
        "final_answer": "Final answer.",
        "conversation_id": "conversation-id",
        "room_id": "room-id",
        "source": "research_orchestrator",
    }


def test_send_final_answer_posts_without_optional_token(
    monkeypatch: MonkeyPatch,
) -> None:
    captured: dict[str, Any] = {}

    def fake_urlopen(request: Request, *, timeout: int) -> FakeResponse:
        captured["headers"] = request.headers
        return FakeResponse(status=200, body={})

    monkeypatch.setenv(
        "BACKEND_FINAL_ANSWER_URL",
        "https://backend.example.test/api/final-answer",
    )
    monkeypatch.delenv("BACKEND_API_TOKEN", raising=False)
    monkeypatch.setattr(orchestrator_module, "urlopen", fake_urlopen)

    result = ResearchOrchestratorAgent().send_final_answer_to_backend("Answer")

    assert result == "Final answer sent to backend."
    assert "Authorization" not in captured["headers"]


def test_send_final_answer_returns_http_error(monkeypatch: MonkeyPatch) -> None:
    def fake_urlopen(request: Request, *, timeout: int) -> FakeResponse:
        return FakeResponse(status=500, body="backend failed")

    monkeypatch.setenv(
        "BACKEND_FINAL_ANSWER_URL",
        "https://backend.example.test/api/final-answer",
    )
    monkeypatch.setattr(orchestrator_module, "urlopen", fake_urlopen)

    result = ResearchOrchestratorAgent().send_final_answer_to_backend("Answer")

    assert "Backend returned status 500" in result
    assert "backend failed" in result
