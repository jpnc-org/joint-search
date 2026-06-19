from __future__ import annotations

import json
import os
from inspect import cleandoc
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from agents.band.registry import AgentType, agent

BACKEND_FINAL_ANSWER_TIMEOUT_SECONDS = 30


@agent(names=("research_orchestrator",), agent_type=AgentType.ORCHESTRATOR)
class ResearchOrchestratorAgent:
    @classmethod
    def instructions(cls) -> str:
        return cleandoc(
            """
            You are the main research quality orchestrator.

            Receive the original research task. Your first action is to
            delegate topic decomposition to research_planner.

            After receiving the decomposition, you will receive research
            findings from the medior.

            Accept the output of medior as the final draft.

            When the answer is ready, first call send_final_answer_to_backend
            with the final answer and any available conversation_id or room_id.
            Then publish the same final answer as a room-wide task event without
            mentioning anyone.
            """
        )

    @agent.tool
    def send_final_answer_to_backend(
        self,
        final_answer: str,
        room_id: str = "",
    ) -> str:
        """Send the final research answer to the configured backend endpoint.

        Args:
            final_answer: Final answer text to persist in the backend.
            room_id: Optional Band room identifier for traceability.
        """

        normalized_answer = final_answer.strip()
        if not normalized_answer:
            return "Error: final_answer must not be empty."

        backend_url = os.getenv("BACKEND_FINAL_ANSWER_URL")
        if not backend_url:
            return "Error: BACKEND_FINAL_ANSWER_URL is not configured."

        payload = {
            "final_answer": normalized_answer,
            "room_id": room_id.strip() or None,
            "source": "research_orchestrator",
        }
        headers = {"Content-Type": "application/json"}

        backend_token = os.getenv("BACKEND_API_TOKEN")
        if backend_token:
            headers["Authorization"] = f"Bearer {backend_token}"

        request = Request(
            backend_url,
            data=json.dumps(payload).encode(),
            headers=headers,
            method="POST",
        )

        try:
            with urlopen(
                request,
                timeout=BACKEND_FINAL_ANSWER_TIMEOUT_SECONDS,
            ) as response:
                status = _response_status(response)
                response_body = response.read().decode(errors="replace")
        except HTTPError as exc:
            response_body = exc.read().decode(errors="replace")
            return (
                f"Error: Backend returned status {exc.code}. Response: {response_body}"
            )
        except URLError as exc:
            return (
                f"Error: Failed to send final answer to backend. Reason: {exc.reason}"
            )
        except OSError as exc:
            return f"Error: Failed to send final answer to backend. Exception: {exc}"

        if status < 200 or status >= 300:
            return f"Error: Backend returned status {status}. Response: {response_body}"

        message_id = _extract_backend_message_id(response_body)
        if message_id:
            return f"Final answer sent to backend. Message ID: {message_id}"

        return "Final answer sent to backend."


def _response_status(response: Any) -> int:
    raw_status = getattr(response, "status", None)
    if isinstance(raw_status, int):
        return raw_status

    getcode = getattr(response, "getcode", None)
    if callable(getcode):
        status = getcode()
        if isinstance(status, int):
            return status

    return 200


def _extract_backend_message_id(response_body: str) -> str | None:
    if not response_body.strip():
        return None

    try:
        data = json.loads(response_body)
    except json.JSONDecodeError:
        return None

    if not isinstance(data, dict):
        return None

    for key in ("messageId", "message_id", "id"):
        value = data.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()

    return None
