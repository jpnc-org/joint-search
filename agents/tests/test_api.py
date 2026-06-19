from __future__ import annotations

import asyncio
from typing import Any

from fastapi.testclient import TestClient
from pytest import MonkeyPatch

import agents.api as api_module
from agents.api import create_app
from agents.research_request_completions import ResearchRequestCompletion


def test_health_endpoint() -> None:
    client = TestClient(create_app(load_environment=False, start_agent_runner=False))

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_research_endpoint_creates_room_and_returns_completion(
    monkeypatch: MonkeyPatch,
) -> None:
    calls: dict[str, Any] = {}

    async def fake_create_research_room(**kwargs: Any) -> None:
        calls["create_research_room"] = kwargs

    async def fake_wait_for_research_request_completion(
        request_id: str,
        *,
        max_wait_seconds: float | None = None,
    ) -> ResearchRequestCompletion:
        calls["wait"] = {
            "request_id": request_id,
            "max_wait_seconds": max_wait_seconds,
        }
        return ResearchRequestCompletion(
            request_id=request_id,
            answer="Final answer.",
        )

    monkeypatch.setenv("BAND_AGENT_API_KEY", "agent-api-key")
    monkeypatch.setenv("BAND_REST_URL", "https://band.example.test/api/v1")
    monkeypatch.setenv("AGENTS_RESEARCH_TIMEOUT_SECONDS", "12.5")
    monkeypatch.setattr(api_module, "create_research_room", fake_create_research_room)
    monkeypatch.setattr(
        api_module,
        "wait_for_research_request_completion",
        fake_wait_for_research_request_completion,
    )
    client = TestClient(create_app(load_environment=False, start_agent_runner=False))

    response = client.post(
        "/research",
        json={
            "request_id": " request-id ",
            "task": " Research the market. ",
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "request_id": "request-id",
        "answer": "Final answer.",
        "status": "completed",
        "source": "research_orchestrator",
    }
    assert calls["create_research_room"] == {
        "task": "Research the market.",
        "band_agent_api_key": "agent-api-key",
        "band_rest_url": "https://band.example.test/api/v1",
        "agent_config_path": ".",
        "backend_request_id": "request-id",
    }
    assert calls["wait"] == {
        "request_id": "request-id",
        "max_wait_seconds": 12.5,
    }


def test_research_endpoint_rejects_empty_fields(monkeypatch: MonkeyPatch) -> None:
    monkeypatch.setenv("BAND_AGENT_API_KEY", "agent-api-key")
    monkeypatch.setenv("BAND_REST_URL", "https://band.example.test/api/v1")
    client = TestClient(create_app(load_environment=False, start_agent_runner=False))

    response = client.post(
        "/research",
        json={
            "request_id": " ",
            "task": "Research the market.",
        },
    )

    assert response.status_code == 422
    assert "request_id must not be empty" in response.json()["detail"]


def test_research_endpoint_requires_band_configuration(
    monkeypatch: MonkeyPatch,
) -> None:
    monkeypatch.delenv("BAND_AGENT_API_KEY", raising=False)
    monkeypatch.setenv("BAND_REST_URL", "https://band.example.test/api/v1")
    client = TestClient(create_app(load_environment=False, start_agent_runner=False))

    response = client.post(
        "/research",
        json={
            "request_id": "request-id",
            "task": "Research the market.",
        },
    )

    assert response.status_code == 500
    assert "BAND_AGENT_API_KEY" in response.json()["detail"]


def test_research_endpoint_returns_gateway_timeout(
    monkeypatch: MonkeyPatch,
) -> None:
    async def fake_create_research_room(**kwargs: Any) -> None:
        return None

    async def fake_wait_for_research_request_completion(
        request_id: str,
        *,
        max_wait_seconds: float | None = None,
    ) -> ResearchRequestCompletion:
        raise TimeoutError

    monkeypatch.setenv("BAND_AGENT_API_KEY", "agent-api-key")
    monkeypatch.setenv("BAND_REST_URL", "https://band.example.test/api/v1")
    monkeypatch.setattr(api_module, "create_research_room", fake_create_research_room)
    monkeypatch.setattr(
        api_module,
        "wait_for_research_request_completion",
        fake_wait_for_research_request_completion,
    )
    client = TestClient(create_app(load_environment=False, start_agent_runner=False))

    response = client.post(
        "/research",
        json={
            "request_id": "request-id",
            "task": "Research the market.",
        },
    )

    assert response.status_code == 504
    assert "timed out" in response.json()["detail"]


def test_api_lifespan_starts_and_stops_agent_runner(
    monkeypatch: MonkeyPatch,
) -> None:
    calls: list[str] = []

    class FakeRegistry:
        async def start_agents(self) -> None:
            calls.append("start_agents")
            try:
                await asyncio.Event().wait()
            except BaseException:
                calls.append("stop_agents")
                raise

    monkeypatch.setattr(api_module, "Registry", FakeRegistry)

    with TestClient(create_app(load_environment=False)) as client:
        response = client.get("/health")

        assert response.status_code == 200
        assert calls == ["start_agents"]

    assert calls == ["start_agents", "stop_agents"]
