import asyncio
from dataclasses import dataclass
from typing import Any

import pytest
from pytest import MonkeyPatch

import agents.list_agents as list_agents_module
from agents.band.client import ParticipantSpec


@dataclass(frozen=True)
class FakeProfile:
    id: str
    owner_uuid: str


@dataclass(frozen=True)
class FakePeer:
    id: str


@dataclass(frozen=True)
class FakeRoom:
    id: str


def test_build_participants_adds_owner_and_deduplicated_peers() -> None:
    assert list_agents_module.build_participants(
        owner_user_id="owner-user-id",
        current_agent_id="agent-a-id",
        peer_ids=["agent-b-id", "agent-a-id", "owner-user-id", " agent-c-id "],
    ) == [
        ("owner-user-id", "member"),
        ("agent-b-id", "member"),
        ("agent-c-id", "member"),
    ]


def test_list_agents_main_creates_room_and_adds_owner_and_peers(
    capsys: pytest.CaptureFixture[str],
    monkeypatch: MonkeyPatch,
) -> None:
    async def scenario() -> None:
        calls: list[Any] = []

        class FakeBandClient:
            def __init__(self, *, api_key: str, base_url: str) -> None:
                calls.append({"api_key": api_key, "base_url": base_url})

            async def get_me(self) -> FakeProfile:
                calls.append("get_me")
                return FakeProfile(id="agent-a-id", owner_uuid="owner-user-id")

            async def create_room(self) -> FakeRoom:
                calls.append("create_room")
                return FakeRoom(id="room-id")

            async def list_peers(
                self,
                *,
                not_in_chat: str | None = None,
                page: int | None = None,
                page_size: int | None = None,
            ) -> list[FakePeer]:
                calls.append(
                    {
                        "not_in_chat": not_in_chat,
                        "page": page,
                        "page_size": page_size,
                    }
                )
                return [FakePeer(id="agent-b-id")]

            async def add_participants(
                self,
                *,
                room_id: str,
                participants: list[ParticipantSpec],
            ) -> None:
                calls.append({"room_id": room_id, "participants": participants})

        monkeypatch.setenv("BAND_AGENT_API_KEY", "agent-key")
        monkeypatch.setenv("BAND_REST_URL", "https://band.example.test")
        monkeypatch.setattr(
            list_agents_module,
            "load_dotenv",
            lambda: calls.append("dotenv"),
            raising=False,
        )
        monkeypatch.setattr(list_agents_module, "BandClient", FakeBandClient)

        await list_agents_module.main()

        assert calls == [
            "dotenv",
            {"api_key": "agent-key", "base_url": "https://band.example.test"},
            "get_me",
            "create_room",
            {"not_in_chat": "room-id", "page": 1, "page_size": 100},
            {
                "room_id": "room-id",
                "participants": [
                    ("owner-user-id", "member"),
                    ("agent-b-id", "member"),
                ],
            },
        ]
        assert capsys.readouterr().out == (
            "Created room room-id with authenticated agent and "
            "2 added participants:\n"
            "- owner-user-id (member)\n"
            "- agent-b-id (member)\n"
        )

    asyncio.run(scenario())


def test_list_agents_main_prints_when_no_additional_participants(
    capsys: pytest.CaptureFixture[str],
    monkeypatch: MonkeyPatch,
) -> None:
    async def scenario() -> None:
        calls: list[str] = []

        class FakeBandClient:
            def __init__(self, *, api_key: str, base_url: str) -> None:
                calls.append("band_client")

            async def get_me(self) -> FakeProfile:
                calls.append("get_me")
                return FakeProfile(id="agent-a-id", owner_uuid="")

            async def create_room(self) -> FakeRoom:
                calls.append("create_room")
                return FakeRoom(id="room-id")

            async def list_peers(
                self,
                *,
                not_in_chat: str | None = None,
                page: int | None = None,
                page_size: int | None = None,
            ) -> list[FakePeer]:
                calls.append("list_peers")
                return []

            async def add_participants(
                self,
                *,
                room_id: str,
                participants: list[ParticipantSpec],
            ) -> None:
                raise AssertionError("participants should not be added")

        monkeypatch.setenv("BAND_AGENT_API_KEY", "agent-key")
        monkeypatch.setenv("BAND_REST_URL", "https://band.example.test")
        monkeypatch.setattr(
            list_agents_module,
            "load_dotenv",
            lambda: calls.append("dotenv"),
            raising=False,
        )
        monkeypatch.setattr(list_agents_module, "BandClient", FakeBandClient)

        await list_agents_module.main()

        assert calls == ["dotenv", "band_client", "get_me", "create_room", "list_peers"]
        assert (
            capsys.readouterr().out
            == "Created room room-id; no additional participants found.\n"
        )

    asyncio.run(scenario())


def test_list_agents_main_requires_agent_api_key(monkeypatch: MonkeyPatch) -> None:
    monkeypatch.delenv("BAND_AGENT_API_KEY", raising=False)
    monkeypatch.setenv("BAND_REST_URL", "https://band.example.test")
    monkeypatch.setattr(list_agents_module, "load_dotenv", lambda: None)

    with pytest.raises(ValueError, match="BAND_AGENT_API_KEY"):
        asyncio.run(list_agents_module.main())
