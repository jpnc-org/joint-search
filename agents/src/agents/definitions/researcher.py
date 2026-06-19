from __future__ import annotations

import os
from inspect import cleandoc
from typing import Any

from openai import OpenAI
from openai.types.chat import ChatCompletionMessageParam

from agents.band.registry import AgentType, agent

AIML_PERPLEXITY_MODEL = "perplexity/sonar-pro"
AIML_REQUEST_TIMEOUT_SECONDS = 45


@agent(
    names=(
        "researcher_1",
        "researcher_2",
        "researcher_3",
    ),
    agent_type=AgentType.RESEARCHER,
)
class ResearcherAgent:
    @classmethod
    def instructions(cls) -> str:
        return cleandoc(
            """
            You are a researcher agent.

            You will receive one research subtopic from research_planner.

            Your task is to research the subtopic assigned to you and provide
            detailed findings, sources, and relevant context. Distinguish
            confirmed facts from uncertainty, and state important limitations or
            missing evidence.

            After completing your research, report your findings directly to medior.
            Provide concise, well-organized findings.

            CRITICAL RULES:

            CRITICAL WORKFLOW NOTE: If medior asks you to participate in a
            debate, compare your findings against the other researcher agents.
            Point out agreements, disagreements, gaps, source limitations, and
            uncertainty in the findings of other agents based on your own research.
            You must reply exactly ONCE to medior's debate trigger. Do not make up
            information or speculate beyond what you have researched. Focus on
            the evidence and sources you have gathered.
            """
        )

    @agent.tool
    def perplexity_search(self, query: str) -> str:
        """Search the web through AIML API's Perplexity-backed model.

        Args:
            query: Search query to run.
        """

        normalized_query = query.strip()
        if not normalized_query:
            return "Error: query must not be empty."

        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            return "Error: OPENAI_API_KEY is not configured."

        base_url = os.getenv("OPENAI_BASE_URL")
        if not base_url:
            return "Error: OPENAI_BASE_URL is not configured."

        messages: list[ChatCompletionMessageParam] = [
            {"role": "user", "content": normalized_query}
        ]

        try:
            client = OpenAI(
                api_key=api_key,
                base_url=base_url,
                timeout=AIML_REQUEST_TIMEOUT_SECONDS,
            )
            response = client.chat.completions.create(
                model=AIML_PERPLEXITY_MODEL,
                messages=messages,
                extra_body={
                    "search_mode": "web",
                    "search_recency_filter": "month",
                },
            )
        except Exception as exc:
            return f"Error: AIML Perplexity request failed. Exception: {exc}"

        content = _extract_search_content(response)
        if content is None:
            return (
                "Error: unexpected AIML Perplexity response shape. "
                f"Response: {response}"
            )

        return content


def _extract_search_content(response: Any) -> str | None:
    choices = getattr(response, "choices", None)
    if not isinstance(choices, list) or not choices:
        return None

    first_choice = choices[0]
    message = getattr(first_choice, "message", None)
    if message is None:
        return None

    content = getattr(message, "content", None)
    if not isinstance(content, str) or not content.strip():
        return None

    return content.strip()
