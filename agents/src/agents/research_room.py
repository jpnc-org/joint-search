from __future__ import annotations

import argparse
import asyncio
import os
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from inspect import cleandoc
from pathlib import Path

from dotenv import load_dotenv

from agents.band.client import (
    BandClient,
    BandMention,
    BandRoom,
    BandSentMessage,
    ParticipantSpec,
)
from agents.band.registry import (
    AgentDefinition,
    AgentSpec,
    AgentType,
    iter_agent_specs,
    load_agent_definitions,
)

DEFAULT_ORCHESTRATOR_NAME = "research_orchestrator"
DEFAULT_PLANNER_NAME = "research_planner"
DEFAULT_MEDIOR_NAME = "medior"
PARTICIPANT_ROLE = "member"
AGENTS_PROJECT_ROOT = Path(__file__).resolve().parents[2]


@dataclass(frozen=True)
class ResearchRoomResult:
    """Result returned after creating and kicking off a research room."""

    room: BandRoom
    participant_names: tuple[str, ...]
    kickoff_message: BandSentMessage


def default_agent_specs() -> tuple[AgentSpec, ...]:
    """Import registered agent definitions and return the current agent specs."""

    import agents.definitions  # noqa: F401

    return iter_agent_specs()


async def create_research_room(
    task: str,
    *,
    band_agent_api_key: str,
    band_rest_url: str,
    agent_config_path: str = ".",
    task_id: str | None = None,
    orchestrator_name: str = DEFAULT_ORCHESTRATOR_NAME,
    planner_name: str = DEFAULT_PLANNER_NAME,
    medior_name: str = DEFAULT_MEDIOR_NAME,
) -> ResearchRoomResult:
    """Create a research room using env/config inputs and a live Band client.

    The API-user agent key creates the room and posts the kickoff message. The
    orchestrator's configured agent key is used only to resolve its Band handle,
    which Band requires when sending an initial mention.
    """

    agent_definitions = load_agent_definitions(agent_config_path)
    client = BandClient(
        api_key=band_agent_api_key,
        base_url=band_rest_url,
    )
    orchestrator_definition = agent_definitions[orchestrator_name]
    orchestrator_profile = await BandClient(
        api_key=orchestrator_definition.band_api_key,
        base_url=band_rest_url,
    ).get_me()

    return await setup_research_room(
        client=client,
        task=task,
        agent_definitions=agent_definitions,
        task_id=task_id,
        orchestrator_name=orchestrator_name,
        orchestrator_handle=orchestrator_profile.handle,
        planner_name=planner_name,
        medior_name=medior_name,
    )


def build_parser() -> argparse.ArgumentParser:
    """Build the minimal CLI parser for manual research-room smoke tests."""

    parser = argparse.ArgumentParser(
        description="Create a Band research room and send the kickoff task.",
    )
    parser.add_argument("task", help="Research question or task to investigate.")
    parser.add_argument(
        "--task-id",
        default=None,
        help="Optional Band task ID to associate with the created room.",
    )
    parser.add_argument(
        "--agent-config",
        default=".",
        help="Path to agent_config.yaml or a directory containing it.",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> None:
    """Run the module as a small CLI for checking room creation manually."""

    parser = build_parser()
    args = parser.parse_args(argv)

    load_dotenv(dotenv_path=AGENTS_PROJECT_ROOT / ".env")

    band_rest_url = os.getenv("BAND_REST_URL")
    if not band_rest_url:
        parser.error("BAND_REST_URL environment variable is not set.")

    band_agent_api_key = os.getenv("BAND_AGENT_API_KEY")
    if not band_agent_api_key:
        parser.error("BAND_AGENT_API_KEY environment variable is not set.")

    result = asyncio.run(
        create_research_room(
            args.task,
            band_agent_api_key=band_agent_api_key,
            band_rest_url=band_rest_url,
            agent_config_path=args.agent_config,
            task_id=args.task_id,
        )
    )

    print(f"Created Band room: {result.room.id}")
    print(f"Participants: {', '.join(result.participant_names)}")
    print(f"Kickoff message: {result.kickoff_message.id}")


def select_research_room_participant_names(
    *,
    agent_specs: Sequence[AgentSpec],
    orchestrator_name: str = DEFAULT_ORCHESTRATOR_NAME,
    planner_name: str = DEFAULT_PLANNER_NAME,
    medior_name: str = DEFAULT_MEDIOR_NAME,
) -> tuple[str, ...]:
    """Select the orchestrator, planner, medior, and all researcher names.

    Raises:
        ValueError: If the orchestrator, planner, medior, or any researcher
            agent is not registered.
    """

    specs_by_name = {spec.name: spec for spec in agent_specs}
    for required_name in (orchestrator_name, planner_name, medior_name):
        if required_name not in specs_by_name:
            raise ValueError(f"Agent '{required_name}' is not registered.")

    researcher_names = [
        spec.name for spec in agent_specs if spec.agent_type is AgentType.RESEARCHER
    ]
    if not researcher_names:
        raise ValueError("At least one researcher agent must be registered.")

    return _dedupe_names(
        (orchestrator_name, planner_name, medior_name, *researcher_names)
    )


def build_research_room_kickoff_message(
    *,
    task: str,
    orchestrator_name: str = DEFAULT_ORCHESTRATOR_NAME,
    planner_name: str = DEFAULT_PLANNER_NAME,
    medior_name: str = DEFAULT_MEDIOR_NAME,
) -> str:
    """Build the kickoff message that mentions only the orchestrator."""
    return cleandoc(
        f"""
        @{orchestrator_name} please coordinate this research task.

        Original task:
        {task}

        Pass this task to {planner_name} for decomposition. Expect the answer
        from {medior_name}
        """
    )

    # return cleandoc(
    #     f"""
    #     @{orchestrator_name} please coordinate this research task.

    #     Original task:
    #     {task}

    #     Workflow:
    #     1. Ask {planner_name} to decompose the task and assign researcher work.
    #     2. Have {planner_name} use {medior_name} for a focused researcher
    #     debate before draft synthesis.
    #     3. Review the synthesized draft for quality.
    #     4. If needed, send one second-pass request to {planner_name} with
    #     additional instructions.
    #     5. Publish the final answer as a room-wide task event without mentions.
    #     """
    # )


async def setup_research_room(
    *,
    client: BandClient,
    task: str,
    agent_definitions: Mapping[str, AgentDefinition],
    agent_specs: Sequence[AgentSpec] | None = None,
    task_id: str | None = None,
    orchestrator_name: str = DEFAULT_ORCHESTRATOR_NAME,
    orchestrator_handle: str | None = None,
    planner_name: str = DEFAULT_PLANNER_NAME,
    medior_name: str = DEFAULT_MEDIOR_NAME,
) -> ResearchRoomResult:
    """Create the Band room, add participants, and send the kickoff message.

    This pure orchestration layer accepts a configured `BandClient`, making it
    straightforward to unit-test room setup without reading environment
    variables or making live Band calls.
    """

    normalized_task = task.strip()
    if not normalized_task:
        raise ValueError("task must not be empty.")

    resolved_agent_specs = (
        tuple(agent_specs) if agent_specs is not None else (default_agent_specs())
    )
    participant_names = select_research_room_participant_names(
        agent_specs=resolved_agent_specs,
        orchestrator_name=orchestrator_name,
        planner_name=planner_name,
        medior_name=medior_name,
    )

    for participant_name in participant_names:
        if participant_name not in agent_definitions:
            raise ValueError(
                f"Agent '{participant_name}' is missing from agent_config.yaml."
            )

    normalized_orchestrator_handle = (orchestrator_handle or "").strip()
    if not normalized_orchestrator_handle:
        raise ValueError("orchestrator_handle must not be empty.")

    participants: list[ParticipantSpec] = [
        (agent_definitions[name].band_agent_id, PARTICIPANT_ROLE)
        for name in participant_names
    ]
    room = await client.create_room_with_participants(
        participants=participants,
        task_id=task_id,
    )

    orchestrator_definition = agent_definitions[orchestrator_name]
    kickoff_message = await client.send_message(
        room_id=room.id,
        content=build_research_room_kickoff_message(
            task=normalized_task,
            orchestrator_name=orchestrator_name,
            planner_name=planner_name,
            medior_name=medior_name,
        ),
        mentions=[
            BandMention(
                id=orchestrator_definition.band_agent_id,
                handle=normalized_orchestrator_handle,
                name=orchestrator_name,
            )
        ],
    )

    return ResearchRoomResult(
        room=room,
        participant_names=participant_names,
        kickoff_message=kickoff_message,
    )


def _dedupe_names(names: Sequence[str]) -> tuple[str, ...]:
    """Return names in first-seen order with duplicates removed."""

    unique_names: list[str] = []
    seen_names: set[str] = set()
    for name in names:
        if name in seen_names:
            continue
        unique_names.append(name)
        seen_names.add(name)
    return tuple(unique_names)


if __name__ == "__main__":
    main()
