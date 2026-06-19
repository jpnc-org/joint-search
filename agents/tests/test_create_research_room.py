from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from pytest import MonkeyPatch

import agents.research_room as research_room_module
from agents.band.client import BandRoom, BandSentMessage
from agents.band.registry import AgentDefinition
from agents.research_room import ResearchRoomResult, create_research_room


def test_create_research_room_loads_config_resolves_handle_and_sets_up_room(
    monkeypatch: MonkeyPatch,
) -> None:
    async def scenario() -> None:
        calls: dict[str, Any] = {}
        created_clients: list[dict[str, str]] = []
        agent_definitions = {
            "research_orchestrator": AgentDefinition(
                name="research_orchestrator",
                band_agent_id="orchestrator-id",
                band_api_key="orchestrator-agent-key",
            )
        }

        class FakeBandClient:
            def __init__(self, *, api_key: str, base_url: str) -> None:
                created_clients.append({"api_key": api_key, "base_url": base_url})

            async def get_me(self) -> Any:
                return type(
                    "FakeProfile",
                    (),
                    {"handle": "owner/research-orchestrator"},
                )()

        def fake_load_agent_definitions(
            agent_config_path: str,
        ) -> dict[str, AgentDefinition]:
            calls["agent_config_path"] = agent_config_path
            return agent_definitions

        async def fake_setup_research_room(**kwargs: Any) -> ResearchRoomResult:
            calls["setup_kwargs"] = kwargs
            return ResearchRoomResult(
                room=BandRoom(
                    id="room-id",
                    title="Room",
                    task_id="task-id",
                    inserted_at=datetime(2026, 1, 1, tzinfo=UTC),
                    updated_at=datetime(2026, 1, 1, tzinfo=UTC),
                ),
                participant_names=("research_orchestrator", "research_planner"),
                kickoff_message=BandSentMessage(
                    id="message-id",
                    success=True,
                    recipients=(),
                ),
            )

        monkeypatch.setattr(research_room_module, "BandClient", FakeBandClient)
        monkeypatch.setattr(
            research_room_module,
            "load_agent_definitions",
            fake_load_agent_definitions,
        )
        monkeypatch.setattr(
            research_room_module,
            "setup_research_room",
            fake_setup_research_room,
        )

        result = await create_research_room(
            "Research task",
            band_agent_api_key="api-agent-key",
            band_rest_url="https://band.example.test",
            agent_config_path="config.yaml",
            task_id="task-id",
            orchestrator_name="research_orchestrator",
            planner_name="research_planner",
        )

        assert result.room.id == "room-id"
        assert created_clients == [
            {
                "api_key": "api-agent-key",
                "base_url": "https://band.example.test",
            },
            {
                "api_key": "orchestrator-agent-key",
                "base_url": "https://band.example.test",
            },
        ]
        assert calls["agent_config_path"] == "config.yaml"
        assert calls["setup_kwargs"]["task"] == "Research task"
        assert calls["setup_kwargs"]["task_id"] == "task-id"
        assert calls["setup_kwargs"]["orchestrator_name"] == "research_orchestrator"
        assert calls["setup_kwargs"]["orchestrator_handle"] == (
            "owner/research-orchestrator"
        )
        assert calls["setup_kwargs"]["planner_name"] == "research_planner"
        assert calls["setup_kwargs"]["agent_definitions"] is agent_definitions

    asyncio.run(scenario())


def test_main_loads_env_creates_room_and_prints_result(
    monkeypatch: MonkeyPatch,
    capsys: Any,
) -> None:
    calls: dict[str, Any] = {}

    def fake_load_dotenv(dotenv_path: Path) -> None:
        calls["dotenv_path"] = dotenv_path

    async def fake_create_research_room(
        *args: Any,
        **kwargs: Any,
    ) -> ResearchRoomResult:
        calls["args"] = args
        calls["kwargs"] = kwargs
        return ResearchRoomResult(
            room=BandRoom(
                id="room-id",
                title="Room",
                task_id="task-id",
                inserted_at=datetime(2026, 1, 1, tzinfo=UTC),
                updated_at=datetime(2026, 1, 1, tzinfo=UTC),
            ),
            participant_names=("research_orchestrator", "research_planner"),
            kickoff_message=BandSentMessage(
                id="message-id",
                success=True,
                recipients=(),
            ),
        )

    monkeypatch.setenv("BAND_REST_URL", "https://band.example.test")
    monkeypatch.setenv("BAND_AGENT_API_KEY", "agent-api-key")
    monkeypatch.setattr(research_room_module, "load_dotenv", fake_load_dotenv)
    monkeypatch.setattr(
        research_room_module,
        "create_research_room",
        fake_create_research_room,
    )

    research_room_module.main(
        [
            "Research task",
            "--task-id",
            "task-id",
            "--agent-config",
            "config.yaml",
        ]
    )

    output = capsys.readouterr().out

    assert calls["args"] == ("Research task",)
    assert calls["kwargs"] == {
        "band_agent_api_key": "agent-api-key",
        "band_rest_url": "https://band.example.test",
        "agent_config_path": "config.yaml",
        "task_id": "task-id",
    }
    assert "Created Band room: room-id" in output
    assert "Participants: research_orchestrator, research_planner" in output
    assert "Kickoff message: message-id" in output


def test_main_rejects_missing_agent_api_key(monkeypatch: MonkeyPatch) -> None:
    monkeypatch.setattr(research_room_module, "load_dotenv", lambda dotenv_path: None)
    monkeypatch.setenv("BAND_REST_URL", "https://band.example.test")
    monkeypatch.delenv("BAND_AGENT_API_KEY", raising=False)

    try:
        research_room_module.main(["Research task"])
    except SystemExit as exc:
        assert exc.code == 2
    else:
        raise AssertionError("Expected main to exit for missing BAND_AGENT_API_KEY")
