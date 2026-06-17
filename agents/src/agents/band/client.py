"""Small async wrapper around Band's Agent API room-management endpoints.

The client intentionally does not read credentials from the environment. Callers
must pass the agent API key and REST base URL explicitly, which keeps scripts and
tests in control of credential sourcing.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Literal, Protocol

from band.client.rest import (
    DEFAULT_REQUEST_OPTIONS,
    AsyncRestClient,
    ChatRoomRequest,
    ParticipantRequest,
)

ParticipantRole = Literal["owner", "admin", "member"]
ParticipantSpec = tuple[str, ParticipantRole]


class BandClientError(RuntimeError):
    """Raised when Band's Agent API rejects or fails a wrapped operation."""

    pass


@dataclass(frozen=True)
class BandRoom:
    """Project-owned representation of a Band chat room.

    Attributes:
        id: Band chat room ID.
        title: Band-generated room title, if one exists.
        task_id: Optional Band task ID associated with the room.
        inserted_at: Room creation timestamp returned by Band.
        updated_at: Room update timestamp returned by Band.
    """

    id: str
    title: str | None
    task_id: str | None
    inserted_at: datetime
    updated_at: datetime


@dataclass(frozen=True)
class BandAgentProfile:
    """Current authenticated Band agent identity.

    Attributes:
        id: Authenticated agent ID.
        name: Agent display name.
        handle: Full agent handle, usually ``owner_handle/agent_slug``.
        owner_uuid: User UUID for the agent owner.
        description: Optional agent description.
        listed_in_directory: Whether Band lists this agent in the directory.
        tags: Agent tags normalized to an immutable tuple.
        inserted_at: Agent creation timestamp returned by Band.
        updated_at: Agent update timestamp returned by Band.
    """

    id: str
    name: str
    handle: str
    owner_uuid: str
    description: str | None
    listed_in_directory: bool | None
    tags: tuple[str, ...]
    inserted_at: datetime
    updated_at: datetime


@dataclass(frozen=True)
class BandPeer:
    """Peer entity that the authenticated Band agent can recruit to a room.

    Attributes:
        id: User UUID or agent ID to use as a participant ID.
        name: Peer display name.
        handle: Peer handle without an ``@`` prefix.
        type: Band peer type, typically ``User`` or ``Agent``.
        source: How Band discovered the peer, such as ``registry`` or
            ``contact``.
        description: Optional peer description.
        is_contact: Whether the peer is also an agent contact.
        is_external: Whether the peer is an external agent, when applicable.
        listed_in_directory: Whether Band lists the peer in the directory.
        tags: Peer tags normalized to an immutable tuple.
    """

    id: str
    name: str
    handle: str
    type: str
    source: str
    description: str | None
    is_contact: bool
    is_external: bool | None
    listed_in_directory: bool | None
    tags: tuple[str, ...]


class _RoomResponseData(Protocol):
    id: str
    title: str | None
    task_id: str | None
    inserted_at: datetime
    updated_at: datetime


class _AgentProfileResponseData(Protocol):
    id: str
    name: str
    handle: str
    owner_uuid: str
    description: str | None
    listed_in_directory: bool | None
    tags: list[str] | None
    inserted_at: datetime
    updated_at: datetime


class _PeerResponseData(Protocol):
    id: str
    name: str
    handle: str
    type: str
    source: str
    description: str | None
    is_contact: bool
    is_external: bool | None
    listed_in_directory: bool | None
    tags: list[str] | None


class _AgentRestClient(Protocol):
    @property
    def agent_api_chats(self) -> Any: ...

    @property
    def agent_api_identity(self) -> Any: ...

    @property
    def agent_api_participants(self) -> Any: ...

    @property
    def agent_api_peers(self) -> Any: ...


class BandClient:
    """Async Band Agent API wrapper for rooms, peers, and participants."""

    def __init__(
        self,
        *,
        api_key: str | None = None,
        base_url: str | None = None,
        rest_client: _AgentRestClient | None = None,
    ) -> None:
        """Create a client from explicit credentials or an injected SDK client.

        Passing ``rest_client`` is intended for tests and advanced callers that
        already own SDK client construction. Otherwise ``api_key`` and
        ``base_url`` are required.

        Args:
            api_key: Band agent API key used for Agent API calls.
            base_url: Band REST API base URL, for example
                ``https://app.band.ai/api/v1``.
            rest_client: Optional pre-built async Band REST client. When
                provided, ``api_key`` and ``base_url`` are not used.

        Raises:
            ValueError: If ``rest_client`` is not provided and either
                ``api_key`` or ``base_url`` is empty.
        """

        self.rest_client = rest_client or self._build_rest_client(
            api_key=api_key,
            base_url=base_url,
        )

    @staticmethod
    def _build_rest_client(
        *,
        api_key: str | None,
        base_url: str | None,
    ) -> _AgentRestClient:
        if not api_key:
            raise ValueError("api_key must be provided.")
        if not base_url:
            raise ValueError("base_url must be provided.")

        return AsyncRestClient(api_key=api_key, base_url=base_url)

    async def get_me(self) -> BandAgentProfile:
        """Return the authenticated agent's profile from ``/agent/me``.

        Returns:
            Normalized profile for the agent represented by this client's API
            key.

        Raises:
            BandClientError: If Band rejects or fails the identity request.
        """

        try:
            response = await self.rest_client.agent_api_identity.get_agent_me(
                request_options=DEFAULT_REQUEST_OPTIONS,
            )
        except Exception as exc:
            raise BandClientError("Band Agent API get me failed.") from exc

        return self._normalize_profile(response.data)

    async def create_room(self, *, task_id: str | None = None) -> BandRoom:
        """Create a new Band room owned by the authenticated agent.

        Args:
            task_id: Optional Band task ID to associate with the room.

        Returns:
            Normalized room created by Band.

        Raises:
            BandClientError: If Band rejects or fails the room creation request.
        """

        try:
            response = await self.rest_client.agent_api_chats.create_agent_chat(
                chat=ChatRoomRequest(task_id=task_id),
                request_options=DEFAULT_REQUEST_OPTIONS,
            )
        except Exception as exc:
            raise BandClientError("Band Agent API create room failed.") from exc

        return self._normalize_room(response.data)

    async def list_peers(
        self,
        *,
        not_in_chat: str | None = None,
        page: int | None = None,
        page_size: int | None = None,
    ) -> list[BandPeer]:
        """List peers recruitable by the authenticated agent.

        ``not_in_chat`` can be set to an existing room ID to ask Band to exclude
        peers that are already participants in that room.

        Args:
            not_in_chat: Optional room ID whose existing participants should be
                excluded from the result.
            page: Optional page number for Band pagination.
            page_size: Optional page size for Band pagination.

        Returns:
            Normalized list of recruitable peers.

        Raises:
            BandClientError: If Band rejects or fails the peer list request.
        """

        try:
            response = await self.rest_client.agent_api_peers.list_agent_peers(
                not_in_chat=not_in_chat,
                page=page,
                page_size=page_size,
                request_options=DEFAULT_REQUEST_OPTIONS,
            )
        except Exception as exc:
            raise BandClientError("Band Agent API list peers failed.") from exc

        return [self._normalize_peer(peer) for peer in response.data]

    async def add_participants(
        self,
        *,
        room_id: str,
        participants: Sequence[ParticipantSpec],
    ) -> None:
        """Add participants to an existing Band room.

        Participant IDs can be Band user UUIDs or agent IDs. Empty room IDs and
        empty participant lists are rejected locally before any HTTP request.

        Args:
            room_id: Band room ID to add participants to.
            participants: Sequence of ``(participant_id, role)`` pairs. The
                participant ID may be a user UUID or agent ID.

        Raises:
            ValueError: If ``room_id`` is empty, ``participants`` is empty, or
                any participant ID is empty.
            BandClientError: If Band rejects or fails a participant add request.
        """

        normalized_room_id = room_id.strip()
        if not normalized_room_id:
            raise ValueError("room_id must not be empty.")

        normalized_participants = [
            (participant_id.strip(), role) for participant_id, role in participants
        ]
        if not normalized_participants or any(
            not participant_id for participant_id, _role in normalized_participants
        ):
            raise ValueError("participants must not contain empty participant IDs.")

        try:
            for participant_id, role in normalized_participants:
                await (
                    self.rest_client.agent_api_participants.add_agent_chat_participant(
                        normalized_room_id,
                        participant=ParticipantRequest(
                            participant_id=participant_id,
                            role=role,
                        ),
                        request_options=DEFAULT_REQUEST_OPTIONS,
                    )
                )
        except Exception as exc:
            raise BandClientError(
                f"Band Agent API add participant failed for room '{room_id}'."
            ) from exc

    async def create_room_with_participants(
        self,
        *,
        participants: Sequence[ParticipantSpec],
        task_id: str | None = None,
    ) -> BandRoom:
        """Create an agent-owned room, then add the requested participants.

        Args:
            participants: Sequence of ``(participant_id, role)`` pairs to add
                after room creation.
            task_id: Optional Band task ID to associate with the new room.

        Returns:
            Normalized room created by Band.

        Raises:
            ValueError: If the participant input is invalid.
            BandClientError: If Band rejects or fails room creation or
                participant addition.
        """

        room = await self.create_room(task_id=task_id)
        await self.add_participants(room_id=room.id, participants=participants)
        return room

    @staticmethod
    def _normalize_room(room: _RoomResponseData) -> BandRoom:
        return BandRoom(
            id=room.id,
            title=room.title,
            task_id=room.task_id,
            inserted_at=room.inserted_at,
            updated_at=room.updated_at,
        )

    @staticmethod
    def _normalize_profile(profile: _AgentProfileResponseData) -> BandAgentProfile:
        return BandAgentProfile(
            id=profile.id,
            name=profile.name,
            handle=profile.handle,
            owner_uuid=profile.owner_uuid,
            description=profile.description,
            listed_in_directory=profile.listed_in_directory,
            tags=tuple(profile.tags or ()),
            inserted_at=profile.inserted_at,
            updated_at=profile.updated_at,
        )

    @staticmethod
    def _normalize_peer(peer: _PeerResponseData) -> BandPeer:
        return BandPeer(
            id=peer.id,
            name=peer.name,
            handle=peer.handle,
            type=peer.type,
            source=peer.source,
            description=peer.description,
            is_contact=peer.is_contact,
            is_external=peer.is_external,
            listed_in_directory=peer.listed_in_directory,
            tags=tuple(peer.tags or ()),
        )
