from __future__ import annotations

from typing import Any

from pytest import MonkeyPatch

import agents.definitions.researcher as researcher_module
from agents.definitions.researcher import ResearcherAgent


class FakeMessage:
    content = "Search result summary."


class FakeChoice:
    message = FakeMessage()


class FakeCompletion:
    choices = [FakeChoice()]


class FakeChatCompletions:
    def __init__(self, calls: dict[str, Any]) -> None:
        self._calls = calls

    def create(self, **kwargs: Any) -> FakeCompletion:
        self._calls["create_kwargs"] = kwargs
        return FakeCompletion()


class FakeChat:
    def __init__(self, calls: dict[str, Any]) -> None:
        self.completions = FakeChatCompletions(calls)


def test_perplexity_search_rejects_missing_openai_api_key(
    monkeypatch: MonkeyPatch,
) -> None:
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.setenv("OPENAI_BASE_URL", "https://api.aimlapi.com/v1")

    result = ResearcherAgent().perplexity_search("AI coding agents")

    assert "OPENAI_API_KEY" in result
    assert "not configured" in result


def test_perplexity_search_rejects_missing_openai_base_url(
    monkeypatch: MonkeyPatch,
) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "test-api-key")
    monkeypatch.delenv("OPENAI_BASE_URL", raising=False)

    result = ResearcherAgent().perplexity_search("AI coding agents")

    assert "OPENAI_BASE_URL" in result
    assert "not configured" in result


def test_perplexity_search_rejects_empty_query(monkeypatch: MonkeyPatch) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "test-api-key")
    monkeypatch.setenv("OPENAI_BASE_URL", "https://api.aimlapi.com/v1")

    result = ResearcherAgent().perplexity_search(" ")

    assert "query must not be empty" in result


def test_perplexity_search_uses_openai_compatible_client(
    monkeypatch: MonkeyPatch,
) -> None:
    calls: dict[str, Any] = {}

    class FakeOpenAI:
        def __init__(self, **kwargs: Any) -> None:
            calls["client_kwargs"] = kwargs
            self.chat = FakeChat(calls)

    monkeypatch.setenv("OPENAI_API_KEY", "test-api-key")
    monkeypatch.setenv("OPENAI_BASE_URL", "https://api.aimlapi.com/v1")
    monkeypatch.setattr(researcher_module, "OpenAI", FakeOpenAI)

    result = ResearcherAgent().perplexity_search("AI coding agents")

    assert result == "Search result summary."
    assert calls["client_kwargs"] == {
        "api_key": "test-api-key",
        "base_url": "https://api.aimlapi.com/v1",
        "timeout": 45,
    }
    assert calls["create_kwargs"] == {
        "model": "perplexity/sonar-pro",
        "messages": [{"role": "user", "content": "AI coding agents"}],
        "extra_body": {
            "search_mode": "web",
            "search_recency_filter": "month",
        },
    }


def test_perplexity_search_returns_client_error(monkeypatch: MonkeyPatch) -> None:
    class FakeChatCompletionsWithError:
        def create(self, **kwargs: Any) -> FakeCompletion:
            raise RuntimeError("service unavailable")

    class FakeChatWithError:
        completions = FakeChatCompletionsWithError()

    class FakeOpenAI:
        def __init__(self, **kwargs: Any) -> None:
            self.chat = FakeChatWithError()

    monkeypatch.setenv("OPENAI_API_KEY", "test-api-key")
    monkeypatch.setenv("OPENAI_BASE_URL", "https://api.aimlapi.com/v1")
    monkeypatch.setattr(researcher_module, "OpenAI", FakeOpenAI)

    result = ResearcherAgent().perplexity_search("AI coding agents")

    assert "AIML Perplexity request failed" in result
    assert "service unavailable" in result


def test_perplexity_search_returns_malformed_response_error(
    monkeypatch: MonkeyPatch,
) -> None:
    class FakeMessageWithoutContent:
        content = None

    class FakeChoiceWithoutContent:
        message = FakeMessageWithoutContent()

    class FakeCompletionWithoutContent:
        choices = [FakeChoiceWithoutContent()]

    class FakeChatCompletionsWithoutContent:
        def create(self, **kwargs: Any) -> FakeCompletionWithoutContent:
            return FakeCompletionWithoutContent()

    class FakeChatWithoutContent:
        completions = FakeChatCompletionsWithoutContent()

    class FakeOpenAI:
        def __init__(self, **kwargs: Any) -> None:
            self.chat = FakeChatWithoutContent()

    monkeypatch.setenv("OPENAI_API_KEY", "test-api-key")
    monkeypatch.setenv("OPENAI_BASE_URL", "https://api.aimlapi.com/v1")
    monkeypatch.setattr(researcher_module, "OpenAI", FakeOpenAI)

    result = ResearcherAgent().perplexity_search("AI coding agents")

    assert "unexpected AIML Perplexity response shape" in result
