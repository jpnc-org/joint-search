from __future__ import annotations

import asyncio
import logging
import os

from dotenv import load_dotenv

from agents.band.client import BandClient, ParticipantSpec

logging.basicConfig(level=logging.INFO)


def get_required_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise ValueError(f"{name} environment variable is not set.")
    return value


async def main() -> None:
    load_dotenv()
    band_client = BandClient(
        api_key=get_required_env("BAND_AGENT_API_KEY"),
        base_url=get_required_env("BAND_REST_URL"),
    )

    profile = await band_client.get_me()
    room = await band_client.create_room()
    peers = await band_client.list_peers(not_in_chat=room.id, page=1, page_size=100)
    participants = build_participants(
        owner_user_id=profile.owner_uuid,
        current_agent_id=profile.id,
        peer_ids=[peer.id for peer in peers],
    )
    if not participants:
        print(f"Created room {room.id}; no additional participants found.")
        return

    await band_client.add_participants(room_id=room.id, participants=participants)

    print(
        f"Created room {room.id} with authenticated agent and "
        f"{len(participants)} added participants:"
    )
    for participant_id, role in participants:
        print(f"- {participant_id} ({role})")


def build_participants(
    *,
    owner_user_id: str,
    current_agent_id: str,
    peer_ids: list[str],
) -> list[ParticipantSpec]:
    participant_ids: list[str] = [owner_user_id, *peer_ids]
    seen: set[str] = set()
    participants: list[ParticipantSpec] = []

    for participant_id in participant_ids:
        normalized_participant_id = participant_id.strip()
        if (
            not normalized_participant_id
            or normalized_participant_id == current_agent_id
            or normalized_participant_id in seen
        ):
            continue

        seen.add(normalized_participant_id)
        participants.append((normalized_participant_id, "member"))

    return participants


if __name__ == "__main__":
    asyncio.run(main())
