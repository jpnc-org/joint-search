from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from typing import Any

import pytest
from pytest import MonkeyPatch

from agents.band.client import (
    BandAgentProfile,
    BandClient,
    BandClientError,
    BandMention,
    BandPeer,
    BandRoom,
    BandSentMessage,
)


class FakeChatRoom:
    def __init__(
        self,
        *,
        id: str = "room-id",
        title: str | None = "Room title",
        task_id: str | None = "task-id",
        inserted_at: datetime | None = None,
        updated_at: datetime | None = None,
    ) -> None:
        self.id = id
        self.title = title
        self.task_id = task_id
        self.inserted_at = inserted_at or datetime(2026, 1, 1, tzinfo=UTC)
        self.updated_at = updated_at or datetime(2026, 1, 2, tzinfo=UTC)


class FakeCreateRoomResponse:
    def __init__(self, data: FakeChatRoom) -> None:
        self.data = data


class FakePeer:
    def __init__(
        self,
        *,
        id: str = "peer-id",
        name: str = "Peer",
        handle: str = "owner/peer",
        type: str = "Agent",
        source: str = "registry",
        description: str | None = "Peer description",
        is_contact: bool = False,
        is_external: bool | None = True,
        listed_in_directory: bool | None = False,
        tags: list[str] | None = None,
    ) -> None:
        self.id = id
        self.name = name
        self.handle = handle
        self.type = type
        self.source = source
        self.description = description
        self.is_contact = is_contact
        self.is_external = is_external
        self.listed_in_directory = listed_in_directory
        self.tags = tags


class FakeListPeersResponse:
    def __init__(self, data: list[FakePeer]) -> None:
        self.data = data


class FakeAgentMe:
    def __init__(
        self,
        *,
        id: str = "agent-id",
        name: str = "Agent",
        handle: str = "owner/agent",
        owner_uuid: str = "owner-user-id",
        description: str | None = "Agent description",
        listed_in_directory: bool | None = False,
        tags: list[str] | None = None,
        inserted_at: datetime | None = None,
        updated_at: datetime | None = None,
    ) -> None:
        self.id = id
        self.name = name
        self.handle = handle
        self.owner_uuid = owner_uuid
        self.description = description
        self.listed_in_directory = listed_in_directory
        self.tags = tags
        self.inserted_at = inserted_at or datetime(2026, 1, 1, tzinfo=UTC)
        self.updated_at = updated_at or datetime(2026, 1, 2, tzinfo=UTC)


class FakeAgentMeResponse:
    def __init__(self, data: FakeAgentMe) -> None:
        self.data = data


class FakeMessageSent:
    def __init__(
        self,
        *,
        id: str = "message-id",
        success: bool = True,
        recipients: list[Any] | None = None,
    ) -> None:
        self.id = id
        self.success = success
        self.recipients = recipients or [{"id": "agent-b-id"}]


class FakeMessageSentResponse:
    def __init__(self, data: FakeMessageSent) -> None:
        self.data = data


def test_band_client_builds_rest_client_from_explicit_values(
    monkeypatch: MonkeyPatch,
) -> None:
    created: dict[str, Any] = {}

    class FakeAsyncRestClient:
        def __init__(self, *, api_key: str, base_url: str) -> None:
            created["api_key"] = api_key
            created["base_url"] = base_url

    monkeypatch.setenv("BAND_AGENT_API_KEY", "env-agent-key")
    monkeypatch.setenv("BAND_REST_URL", "https://env.example.test")
    monkeypatch.setattr("agents.band.client.AsyncRestClient", FakeAsyncRestClient)

    client = BandClient(
        api_key="passed-agent-key",
        base_url="https://band.example.test",
    )

    assert client.rest_client is not None
    assert created == {
        "api_key": "passed-agent-key",
        "base_url": "https://band.example.test",
    }


def test_band_client_requires_explicit_api_key() -> None:
    with pytest.raises(ValueError, match="api_key"):
        BandClient(api_key="", base_url="https://band.example.test")


def test_band_client_requires_explicit_base_url() -> None:
    with pytest.raises(ValueError, match="base_url"):
        BandClient(api_key="agent-key", base_url="")


def test_band_client_accepts_injected_rest_client_without_credentials() -> None:
    class FakeRestClient:
        agent_api_chats = object()
        agent_api_identity = object()
        agent_api_messages = object()
        agent_api_participants = object()
        agent_api_peers = object()

    rest_client = FakeRestClient()

    client = BandClient(rest_client=rest_client)

    assert client.rest_client is rest_client


def test_create_room_builds_agent_api_request_with_optional_task_id() -> None:
    async def scenario() -> None:
        calls: list[dict[str, Any]] = []

        class FakeAgentApiChats:
            async def create_agent_chat(
                self,
                *,
                chat: Any,
                request_options: Any,
            ) -> FakeCreateRoomResponse:
                calls.append({"chat": chat, "request_options": request_options})
                return FakeCreateRoomResponse(FakeChatRoom())

        class FakeRestClient:
            def __init__(self) -> None:
                self.agent_api_chats = FakeAgentApiChats()
                self.agent_api_identity = object()
                self.agent_api_messages = object()
                self.agent_api_participants = object()
                self.agent_api_peers = object()

        client = BandClient(rest_client=FakeRestClient())

        await client.create_room(task_id="task-id")

        assert len(calls) == 1
        assert calls[0]["chat"].task_id == "task-id"
        assert calls[0]["request_options"] is not None

    asyncio.run(scenario())


def test_create_room_normalizes_response_to_project_room() -> None:
    async def scenario() -> None:
        inserted_at = datetime(2026, 1, 1, tzinfo=UTC)
        updated_at = datetime(2026, 1, 2, tzinfo=UTC)

        class FakeAgentApiChats:
            async def create_agent_chat(
                self,
                *,
                chat: Any,
                request_options: Any,
            ) -> FakeCreateRoomResponse:
                return FakeCreateRoomResponse(
                    FakeChatRoom(
                        id="room-123",
                        title="Generated room",
                        task_id=None,
                        inserted_at=inserted_at,
                        updated_at=updated_at,
                    )
                )

        class FakeRestClient:
            def __init__(self) -> None:
                self.agent_api_chats = FakeAgentApiChats()
                self.agent_api_identity = object()
                self.agent_api_messages = object()
                self.agent_api_participants = object()
                self.agent_api_peers = object()

        client = BandClient(rest_client=FakeRestClient())

        room = await client.create_room()

        assert room == BandRoom(
            id="room-123",
            title="Generated room",
            task_id=None,
            inserted_at=inserted_at,
            updated_at=updated_at,
        )

    asyncio.run(scenario())


def test_create_room_raises_project_error_for_sdk_failure() -> None:
    async def scenario() -> None:
        class FakeAgentApiChats:
            async def create_agent_chat(
                self,
                *,
                chat: Any,
                request_options: Any,
            ) -> FakeCreateRoomResponse:
                raise RuntimeError("sdk failed")

        class FakeRestClient:
            def __init__(self) -> None:
                self.agent_api_chats = FakeAgentApiChats()
                self.agent_api_identity = object()
                self.agent_api_messages = object()
                self.agent_api_participants = object()
                self.agent_api_peers = object()

        client = BandClient(rest_client=FakeRestClient())

        with pytest.raises(BandClientError, match="create room failed") as exc_info:
            await client.create_room()

        assert isinstance(exc_info.value.__cause__, RuntimeError)

    asyncio.run(scenario())


def test_get_me_normalizes_agent_identity() -> None:
    async def scenario() -> None:
        inserted_at = datetime(2026, 1, 1, tzinfo=UTC)
        updated_at = datetime(2026, 1, 2, tzinfo=UTC)

        class FakeAgentApiIdentity:
            async def get_agent_me(
                self, *, request_options: Any
            ) -> FakeAgentMeResponse:
                return FakeAgentMeResponse(
                    FakeAgentMe(
                        id="agent-id",
                        name="Agent A",
                        handle="owner/agent-a",
                        owner_uuid="owner-user-id",
                        description=None,
                        listed_in_directory=True,
                        tags=["test"],
                        inserted_at=inserted_at,
                        updated_at=updated_at,
                    )
                )

        class FakeRestClient:
            def __init__(self) -> None:
                self.agent_api_chats = object()
                self.agent_api_identity = FakeAgentApiIdentity()
                self.agent_api_messages = object()
                self.agent_api_participants = object()
                self.agent_api_peers = object()

        client = BandClient(rest_client=FakeRestClient())

        profile = await client.get_me()

        assert profile == BandAgentProfile(
            id="agent-id",
            name="Agent A",
            handle="owner/agent-a",
            owner_uuid="owner-user-id",
            description=None,
            listed_in_directory=True,
            tags=("test",),
            inserted_at=inserted_at,
            updated_at=updated_at,
        )

    asyncio.run(scenario())


def test_list_peers_sends_pagination_and_normalizes_response() -> None:
    async def scenario() -> None:
        calls: list[dict[str, Any]] = []

        class FakeAgentApiPeers:
            async def list_agent_peers(
                self,
                *,
                not_in_chat: str | None,
                page: int | None,
                page_size: int | None,
                request_options: Any,
            ) -> FakeListPeersResponse:
                calls.append(
                    {
                        "not_in_chat": not_in_chat,
                        "page": page,
                        "page_size": page_size,
                        "request_options": request_options,
                    }
                )
                return FakeListPeersResponse(
                    [
                        FakePeer(
                            id="agent-b-id",
                            name="Agent B",
                            handle="owner/agent-b",
                            type="Agent",
                            source="registry",
                            tags=["test"],
                        ),
                        FakePeer(
                            id="owner-user-id",
                            name="Owner",
                            handle="owner",
                            type="User",
                            source="contact",
                            description=None,
                            is_external=None,
                            listed_in_directory=None,
                            tags=None,
                        ),
                    ]
                )

        class FakeRestClient:
            def __init__(self) -> None:
                self.agent_api_chats = object()
                self.agent_api_identity = object()
                self.agent_api_messages = object()
                self.agent_api_participants = object()
                self.agent_api_peers = FakeAgentApiPeers()

        client = BandClient(rest_client=FakeRestClient())

        peers = await client.list_peers(
            not_in_chat="room-id",
            page=2,
            page_size=50,
        )

        assert calls == [
            {
                "not_in_chat": "room-id",
                "page": 2,
                "page_size": 50,
                "request_options": calls[0]["request_options"],
            }
        ]
        assert calls[0]["request_options"] is not None
        assert peers == [
            BandPeer(
                id="agent-b-id",
                name="Agent B",
                handle="owner/agent-b",
                type="Agent",
                source="registry",
                description="Peer description",
                is_contact=False,
                is_external=True,
                listed_in_directory=False,
                tags=("test",),
            ),
            BandPeer(
                id="owner-user-id",
                name="Owner",
                handle="owner",
                type="User",
                source="contact",
                description=None,
                is_contact=False,
                is_external=None,
                listed_in_directory=None,
                tags=(),
            ),
        ]

    asyncio.run(scenario())


def test_add_participants_rejects_invalid_input() -> None:
    async def scenario() -> None:
        class FakeRestClient:
            def __init__(self) -> None:
                self.agent_api_chats = object()
                self.agent_api_identity = object()
                self.agent_api_messages = object()
                self.agent_api_participants = object()
                self.agent_api_peers = object()

        client = BandClient(rest_client=FakeRestClient())

        with pytest.raises(ValueError, match="room_id"):
            await client.add_participants(
                room_id="", participants=[("agent-id", "member")]
            )

        with pytest.raises(ValueError, match="participants"):
            await client.add_participants(room_id="room-id", participants=[])

        with pytest.raises(ValueError, match="participants"):
            await client.add_participants(
                room_id="room-id",
                participants=[("agent-id", "member"), (" ", "admin")],
            )

    asyncio.run(scenario())


def test_add_participants_sends_expected_participants() -> None:
    async def scenario() -> None:
        calls: list[dict[str, Any]] = []

        class FakeAgentApiParticipants:
            async def add_agent_chat_participant(
                self,
                chat_id: str,
                *,
                participant: Any,
                request_options: Any,
            ) -> None:
                calls.append(
                    {
                        "chat_id": chat_id,
                        "participant_id": participant.participant_id,
                        "role": participant.role,
                        "request_options": request_options,
                    }
                )

        class FakeRestClient:
            def __init__(self) -> None:
                self.agent_api_chats = object()
                self.agent_api_identity = object()
                self.agent_api_messages = object()
                self.agent_api_participants = FakeAgentApiParticipants()
                self.agent_api_peers = object()

        client = BandClient(rest_client=FakeRestClient())

        await client.add_participants(
            room_id="room-id",
            participants=[("agent-b-id", "member"), ("owner-user-id", "admin")],
        )

        assert calls == [
            {
                "chat_id": "room-id",
                "participant_id": "agent-b-id",
                "role": "member",
                "request_options": calls[0]["request_options"],
            },
            {
                "chat_id": "room-id",
                "participant_id": "owner-user-id",
                "role": "admin",
                "request_options": calls[1]["request_options"],
            },
        ]
        assert calls[0]["request_options"] is not None
        assert calls[1]["request_options"] is not None

    asyncio.run(scenario())


def test_create_room_with_participants_creates_room_then_adds_participants() -> None:
    async def scenario() -> None:
        calls: list[dict[str, Any]] = []

        class FakeAgentApiChats:
            async def create_agent_chat(
                self,
                *,
                chat: Any,
                request_options: Any,
            ) -> FakeCreateRoomResponse:
                calls.append(
                    {
                        "method": "create_room",
                        "task_id": chat.task_id,
                        "request_options": request_options,
                    }
                )
                return FakeCreateRoomResponse(
                    FakeChatRoom(id="created-room", task_id="task-id")
                )

        class FakeAgentApiParticipants:
            async def add_agent_chat_participant(
                self,
                chat_id: str,
                *,
                participant: Any,
                request_options: Any,
            ) -> None:
                calls.append(
                    {
                        "method": "add_participant",
                        "chat_id": chat_id,
                        "participant_id": participant.participant_id,
                        "role": participant.role,
                        "request_options": request_options,
                    }
                )

        class FakeRestClient:
            def __init__(self) -> None:
                self.agent_api_chats = FakeAgentApiChats()
                self.agent_api_identity = object()
                self.agent_api_messages = object()
                self.agent_api_participants = FakeAgentApiParticipants()
                self.agent_api_peers = object()

        client = BandClient(rest_client=FakeRestClient())

        room = await client.create_room_with_participants(
            participants=[("agent-b-id", "member"), ("owner-user-id", "admin")],
            task_id="task-id",
        )

        assert room.id == "created-room"
        assert calls == [
            {
                "method": "create_room",
                "task_id": "task-id",
                "request_options": calls[0]["request_options"],
            },
            {
                "method": "add_participant",
                "chat_id": "created-room",
                "participant_id": "agent-b-id",
                "role": "member",
                "request_options": calls[1]["request_options"],
            },
            {
                "method": "add_participant",
                "chat_id": "created-room",
                "participant_id": "owner-user-id",
                "role": "admin",
                "request_options": calls[2]["request_options"],
            },
        ]

    asyncio.run(scenario())


def test_send_message_rejects_invalid_input() -> None:
    async def scenario() -> None:
        class FakeRestClient:
            def __init__(self) -> None:
                self.agent_api_chats = object()
                self.agent_api_identity = object()
                self.agent_api_messages = object()
                self.agent_api_participants = object()
                self.agent_api_peers = object()

        client = BandClient(rest_client=FakeRestClient())

        with pytest.raises(ValueError, match="room_id"):
            await client.send_message(
                room_id="",
                content="@Agent B hello",
                mentions=[BandMention(id="agent-b-id")],
            )

        with pytest.raises(ValueError, match="content"):
            await client.send_message(
                room_id="room-id",
                content=" ",
                mentions=[BandMention(id="agent-b-id")],
            )

        with pytest.raises(ValueError, match="mentions"):
            await client.send_message(
                room_id="room-id",
                content="@Agent B hello",
                mentions=[],
            )

        with pytest.raises(ValueError, match="mentions"):
            await client.send_message(
                room_id="room-id",
                content="@Agent B hello",
                mentions=[BandMention(id=" ")],
            )

        with pytest.raises(ValueError, match="handles"):
            await client.send_message(
                room_id="room-id",
                content="@Agent B hello",
                mentions=[BandMention(id="agent-b-id")],
            )

    asyncio.run(scenario())


def test_send_message_sends_expected_message_and_normalizes_response() -> None:
    async def scenario() -> None:
        calls: list[dict[str, Any]] = []

        class FakeAgentApiMessages:
            async def create_agent_chat_message(
                self,
                chat_id: str,
                *,
                message: Any,
                request_options: Any,
            ) -> FakeMessageSentResponse:
                calls.append(
                    {
                        "chat_id": chat_id,
                        "content": message.content,
                        "mentions": [
                            {
                                "id": mention.id,
                                "handle": mention.handle,
                                "name": mention.name,
                            }
                            for mention in message.mentions
                        ],
                        "request_options": request_options,
                    }
                )
                return FakeMessageSentResponse(
                    FakeMessageSent(
                        id="sent-message-id",
                        success=True,
                        recipients=[{"id": "agent-b-id"}],
                    )
                )

        class FakeRestClient:
            def __init__(self) -> None:
                self.agent_api_chats = object()
                self.agent_api_identity = object()
                self.agent_api_messages = FakeAgentApiMessages()
                self.agent_api_participants = object()
                self.agent_api_peers = object()

        client = BandClient(rest_client=FakeRestClient())

        sent_message = await client.send_message(
            room_id=" room-id ",
            content=" @Agent B hello from the orchestration test room ",
            mentions=[
                BandMention(
                    id=" agent-b-id ",
                    handle="owner/agent-b",
                    name="Agent B",
                )
            ],
        )

        assert sent_message == BandSentMessage(
            id="sent-message-id",
            success=True,
            recipients=({"id": "agent-b-id"},),
        )
        assert calls == [
            {
                "chat_id": "room-id",
                "content": "@Agent B hello from the orchestration test room",
                "mentions": [
                    {
                        "id": "agent-b-id",
                        "handle": "owner/agent-b",
                        "name": "Agent B",
                    }
                ],
                "request_options": calls[0]["request_options"],
            }
        ]
        assert calls[0]["request_options"] is not None

    asyncio.run(scenario())


def test_send_message_raises_project_error_for_sdk_failure() -> None:
    async def scenario() -> None:
        class FakeAgentApiMessages:
            async def create_agent_chat_message(
                self,
                chat_id: str,
                *,
                message: Any,
                request_options: Any,
            ) -> FakeMessageSentResponse:
                raise RuntimeError("sdk failed")

        class FakeRestClient:
            def __init__(self) -> None:
                self.agent_api_chats = object()
                self.agent_api_identity = object()
                self.agent_api_messages = FakeAgentApiMessages()
                self.agent_api_participants = object()
                self.agent_api_peers = object()

        client = BandClient(rest_client=FakeRestClient())

        with pytest.raises(BandClientError, match="send message failed") as exc_info:
            await client.send_message(
                room_id="room-id",
                content="@Agent B hello",
                mentions=[BandMention(id="agent-b-id", handle="owner/agent-b")],
            )

        assert isinstance(exc_info.value.__cause__, RuntimeError)

    asyncio.run(scenario())
