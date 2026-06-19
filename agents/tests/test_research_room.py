from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from typing import Any

import pytest

from agents.band.client import BandClient
from agents.band.registry import AgentDefinition, AgentSpec, AgentType
from agents.research_room import setup_research_room


def build_agent_definitions() -> dict[str, AgentDefinition]:
    return {
        "research_orchestrator": AgentDefinition(
            name="research_orchestrator",
            band_agent_id="orchestrator-id",
            band_api_key="orchestrator-key",
        ),
        "research_planner": AgentDefinition(
            name="research_planner",
            band_agent_id="planner-id",
            band_api_key="planner-key",
        ),
        "medior": AgentDefinition(
            name="medior",
            band_agent_id="medior-id",
            band_api_key="medior-key",
        ),
        "researcher_1": AgentDefinition(
            name="researcher_1",
            band_agent_id="researcher-1-id",
            band_api_key="researcher-1-key",
        ),
        "researcher_2": AgentDefinition(
            name="researcher_2",
            band_agent_id="researcher-2-id",
            band_api_key="researcher-2-key",
        ),
    }


def build_agent_specs() -> tuple[AgentSpec, ...]:
    return (
        AgentSpec(
            name="research_orchestrator",
            agent_type=AgentType.ORCHESTRATOR,
            instructions="orchestrator instructions",
        ),
        AgentSpec(
            name="research_planner",
            agent_type=AgentType.ORCHESTRATOR,
            instructions="planner instructions",
        ),
        AgentSpec(
            name="medior",
            agent_type=AgentType.ORCHESTRATOR,
            instructions="medior instructions",
        ),
        AgentSpec(
            name="researcher_1",
            agent_type=AgentType.RESEARCHER,
            instructions="researcher instructions",
        ),
        AgentSpec(
            name="researcher_2",
            agent_type=AgentType.RESEARCHER,
            instructions="researcher instructions",
        ),
    )


def test_setup_research_room_creates_room_adds_agents_and_sends_kickoff() -> None:
    async def scenario() -> None:
        calls: list[dict[str, Any]] = []

        class FakeChatRoom:
            id = "room-id"
            title = "Room"
            task_id = "task-id"
            inserted_at = datetime(2026, 1, 1, tzinfo=UTC)
            updated_at = datetime(2026, 1, 1, tzinfo=UTC)

        class FakeCreateRoomResponse:
            data = FakeChatRoom()

        class FakeMessageSent:
            id = "message-id"
            success = True
            recipients: list[Any] = []

        class FakeMessageSentResponse:
            data = FakeMessageSent()

        class FakeAgentApiChats:
            async def create_agent_chat(
                self,
                *,
                chat: Any,
                request_options: Any,
            ) -> FakeCreateRoomResponse:
                calls.append(
                    {
                        "method": "create_agent_chat",
                        "task_id": chat.task_id,
                        "request_options": request_options,
                    }
                )
                return FakeCreateRoomResponse()

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
                        "method": "add_agent_chat_participant",
                        "chat_id": chat_id,
                        "participant_id": participant.participant_id,
                        "role": participant.role,
                        "request_options": request_options,
                    }
                )

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
                        "method": "create_agent_chat_message",
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
                return FakeMessageSentResponse()

        class FakeRestClient:
            def __init__(self) -> None:
                self.agent_api_chats = FakeAgentApiChats()
                self.agent_api_identity = object()
                self.agent_api_messages = FakeAgentApiMessages()
                self.agent_api_participants = FakeAgentApiParticipants()
                self.agent_api_peers = object()

        client = BandClient(rest_client=FakeRestClient())

        result = await setup_research_room(
            client=client,
            task=" Investigate the market. ",
            agent_definitions=build_agent_definitions(),
            agent_specs=build_agent_specs(),
            task_id="task-id",
            orchestrator_handle="owner/research-orchestrator",
        )

        assert result.room.id == "room-id"
        assert result.participant_names == (
            "research_orchestrator",
            "research_planner",
            "medior",
            "researcher_1",
            "researcher_2",
        )
        assert result.kickoff_message.id == "message-id"
        assert calls == [
            {
                "method": "create_agent_chat",
                "task_id": "task-id",
                "request_options": calls[0]["request_options"],
            },
            {
                "method": "add_agent_chat_participant",
                "chat_id": "room-id",
                "participant_id": "orchestrator-id",
                "role": "member",
                "request_options": calls[1]["request_options"],
            },
            {
                "method": "add_agent_chat_participant",
                "chat_id": "room-id",
                "participant_id": "planner-id",
                "role": "member",
                "request_options": calls[2]["request_options"],
            },
            {
                "method": "add_agent_chat_participant",
                "chat_id": "room-id",
                "participant_id": "medior-id",
                "role": "member",
                "request_options": calls[3]["request_options"],
            },
            {
                "method": "add_agent_chat_participant",
                "chat_id": "room-id",
                "participant_id": "researcher-1-id",
                "role": "member",
                "request_options": calls[4]["request_options"],
            },
            {
                "method": "add_agent_chat_participant",
                "chat_id": "room-id",
                "participant_id": "researcher-2-id",
                "role": "member",
                "request_options": calls[5]["request_options"],
            },
            {
                "method": "create_agent_chat_message",
                "chat_id": "room-id",
                "content": calls[6]["content"],
                "mentions": [
                    {
                        "id": "orchestrator-id",
                        "handle": "owner/research-orchestrator",
                        "name": "research_orchestrator",
                    }
                ],
                "request_options": calls[6]["request_options"],
            },
        ]
        assert "@research_orchestrator" in calls[6]["content"]
        assert "Original task:" in calls[6]["content"]
        assert "Investigate the market." in calls[6]["content"]
        assert "research_planner" in calls[6]["content"]
        assert "medior" in calls[6]["content"]
        assert "Expect the answer" in calls[6]["content"]

    asyncio.run(scenario())


def test_setup_research_room_validates_task_and_configured_agents() -> None:
    async def scenario() -> None:
        class FakeRestClient:
            agent_api_chats = object()
            agent_api_identity = object()
            agent_api_messages = object()
            agent_api_participants = object()
            agent_api_peers = object()

        client = BandClient(rest_client=FakeRestClient())

        with pytest.raises(ValueError, match="task"):
            await setup_research_room(
                client=client,
                task=" ",
                agent_definitions=build_agent_definitions(),
                agent_specs=build_agent_specs(),
            )

        definitions = build_agent_definitions()
        definitions.pop("research_orchestrator")
        with pytest.raises(ValueError, match="research_orchestrator"):
            await setup_research_room(
                client=client,
                task="Question",
                agent_definitions=definitions,
                agent_specs=build_agent_specs(),
            )

        definitions = build_agent_definitions()
        definitions.pop("medior")
        with pytest.raises(ValueError, match="medior"):
            await setup_research_room(
                client=client,
                task="Question",
                agent_definitions=definitions,
                agent_specs=build_agent_specs(),
            )

        specs_without_researchers = build_agent_specs()[:3]
        with pytest.raises(ValueError, match="researcher"):
            await setup_research_room(
                client=client,
                task="Question",
                agent_definitions=build_agent_definitions(),
                agent_specs=specs_without_researchers,
            )

        with pytest.raises(ValueError, match="orchestrator_handle"):
            await setup_research_room(
                client=client,
                task="Question",
                agent_definitions=build_agent_definitions(),
                agent_specs=build_agent_specs(),
            )

    asyncio.run(scenario())
