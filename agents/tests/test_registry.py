import asyncio
import logging
from contextlib import suppress
from pathlib import Path
from typing import Any

import pytest
from pytest import MonkeyPatch

from agents.registry import (
    AgentDefinition,
    AgentEntry,
    AgentType,
    Registry,
)


def build_registry_without_loading_config() -> Registry:
    registry = object.__new__(Registry)
    registry._agent_registry = {}
    registry._agent_tasks = {}
    registry._ws_url = "wss://example.test/socket"
    registry._rest_url = "https://example.test"
    return registry


def test_registry_does_not_expose_runtime_create_api() -> None:
    assert not hasattr(build_registry_without_loading_config(), "create")


def test_registry_exposes_only_start_agent_for_execution_lifecycle() -> None:
    registry = build_registry_without_loading_config()

    assert hasattr(registry, "start_agent")
    assert not hasattr(registry, "execute_agent")
    assert not hasattr(registry, "stop_agent")
    assert not hasattr(registry, "_run_agent")


def test_agent_type_values_are_domain_categories() -> None:
    assert AgentType.RESEARCH.value == "RESEARCH"
    assert AgentType.GENERAL_PURPOSE.value == "GENERAL_PURPOSE"


def test_load_agent_definitions_uses_top_level_keys_as_names(tmp_path: Path) -> None:
    config_path = tmp_path / "agent_config.yaml"
    config_path.write_text(
        """
agent_a:
  agent_id: agent-a-id
  api_key: agent-a-key

agent_b:
  agent_id: agent-b-id
  api_key: agent-b-key
""",
        encoding="utf-8",
    )

    registry = build_registry_without_loading_config()

    loaded = registry._load_agent_definitions(config_path)

    assert set(loaded) == {"agent_a", "agent_b"}
    assert set(registry._agent_registry) == {"agent_a", "agent_b"}
    assert registry._agent_registry["agent_a"].agent_definition.name == "agent_a"
    assert (
        registry._agent_registry["agent_a"].agent_definition.band_agent_id
        == "agent-a-id"
    )
    assert (
        registry._agent_registry["agent_a"].agent_definition.band_api_key
        == "agent-a-key"
    )
    assert registry._agent_registry["agent_a"].agent_type is AgentType.GENERAL_PURPOSE
    assert registry._agent_registry["agent_b"].agent_definition.name == "agent_b"
    assert (
        registry._agent_registry["agent_b"].agent_definition.band_agent_id
        == "agent-b-id"
    )
    assert (
        registry._agent_registry["agent_b"].agent_definition.band_api_key
        == "agent-b-key"
    )
    assert registry._agent_registry["agent_b"].agent_type is AgentType.GENERAL_PURPOSE


def test_load_agent_definitions_defaults_to_current_directory_agent_config(
    tmp_path: Path,
    monkeypatch: MonkeyPatch,
) -> None:
    config_path = tmp_path / "agent_config.yaml"
    config_path.write_text(
        """
agent_a:
  agent_id: agent-a-id
  api_key: agent-a-key
""",
        encoding="utf-8",
    )
    monkeypatch.chdir(tmp_path)

    registry = build_registry_without_loading_config()

    loaded = registry._load_agent_definitions()

    assert set(loaded) == {"agent_a"}
    assert loaded["agent_a"].name == "agent_a"
    assert loaded["agent_a"].band_agent_id == "agent-a-id"
    assert loaded["agent_a"].band_api_key == "agent-a-key"


def test_load_agent_definitions_delegates_credentials_to_band_sdk_loader(
    tmp_path: Path,
    monkeypatch: MonkeyPatch,
) -> None:
    config_path = tmp_path / "agent_config.yaml"
    config_path.write_text(
        """
agent_a:
  agent_id: ignored-by-test
  api_key: ignored-by-test

agent_b:
  agent_id: ignored-by-test
  api_key: ignored-by-test
""",
        encoding="utf-8",
    )
    calls: list[tuple[str, Path]] = []

    def fake_load_agent_config(
        agent_key: str,
        *,
        config_path: str | Path | None = None,
    ) -> tuple[str, str]:
        assert isinstance(config_path, Path)
        calls.append((agent_key, config_path))
        return (f"{agent_key}-from-sdk-id", f"{agent_key}-from-sdk-key")

    monkeypatch.setattr(
        "agents.registry.load_agent_config",
        fake_load_agent_config,
    )

    registry = build_registry_without_loading_config()

    loaded = registry._load_agent_definitions(config_path)

    assert calls == [("agent_a", config_path), ("agent_b", config_path)]
    assert loaded["agent_a"].band_agent_id == "agent_a-from-sdk-id"
    assert loaded["agent_a"].band_api_key == "agent_a-from-sdk-key"
    assert loaded["agent_b"].band_agent_id == "agent_b-from-sdk-id"
    assert loaded["agent_b"].band_api_key == "agent_b-from-sdk-key"


def test_load_agent_definitions_empty_file_clears_available_agents(
    tmp_path: Path,
) -> None:
    config_path = tmp_path / "agent_config.yaml"
    config_path.write_text("", encoding="utf-8")

    registry = build_registry_without_loading_config()
    registry._agent_registry["existing"] = AgentEntry(
        agent_definition=AgentDefinition(
            name="existing",
            band_agent_id="existing-id",
            band_api_key="existing-key",
        )
    )

    loaded = registry._load_agent_definitions(config_path)

    assert loaded == {}
    assert registry._agent_registry == {}


def test_load_agent_definitions_rejects_missing_required_fields(
    tmp_path: Path,
) -> None:
    config_path = tmp_path / "agent_config.yaml"
    config_path.write_text(
        """
agent_a:
  agent_id: agent-a-id
""",
        encoding="utf-8",
    )

    registry = build_registry_without_loading_config()

    with pytest.raises(ValueError, match="agent_a"):
        registry._load_agent_definitions(config_path)


def test_load_agent_definitions_rejects_non_mapping_file(tmp_path: Path) -> None:
    config_path = tmp_path / "agent_config.yaml"
    config_path.write_text("- agent_a\n", encoding="utf-8")

    registry = build_registry_without_loading_config()

    with pytest.raises(ValueError, match="YAML mapping"):
        registry._load_agent_definitions(config_path)


def test_load_agent_definitions_rejects_non_mapping_agent_entry(
    tmp_path: Path,
) -> None:
    config_path = tmp_path / "agent_config.yaml"
    config_path.write_text("agent_a: agent-a-id\n", encoding="utf-8")

    registry = build_registry_without_loading_config()

    with pytest.raises(ValueError, match="agent_a"):
        registry._load_agent_definitions(config_path)


def test_start_agent_builds_and_runs_langgraph_agent_in_background(
    monkeypatch: MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    async def scenario() -> None:
        caplog.set_level(logging.INFO, logger="agents.registry")
        registry = build_registry_without_loading_config()
        registry._agent_registry["agent_a"] = AgentEntry(
            agent_definition=AgentDefinition(
                name="agent_a",
                band_agent_id="agent-a-id",
                band_api_key="agent-a-key",
            )
        )
        created: dict[str, Any] = {}
        run_calls: list[float | None] = []
        started = asyncio.Event()
        release = asyncio.Event()

        class FakeChatOpenAI:
            def __init__(self, *, model: str) -> None:
                created["llm_model"] = model

        class FakeInMemorySaver:
            def __init__(self) -> None:
                created["checkpointer"] = self

        class FakeLangGraphAdapter:
            def __init__(
                self,
                *,
                llm: FakeChatOpenAI,
                checkpointer: FakeInMemorySaver,
                custom_section: str,
            ) -> None:
                created["adapter_llm"] = llm
                created["adapter_checkpointer"] = checkpointer
                created["custom_section"] = custom_section

        class FakeBandAgent:
            @classmethod
            def create(cls, **kwargs: Any) -> "FakeBandAgent":
                created["agent_kwargs"] = kwargs
                return cls()

            async def run(self, shutdown_timeout: float | None = 30.0) -> None:
                run_calls.append(shutdown_timeout)
                started.set()
                await release.wait()

        monkeypatch.setattr("agents.registry.ChatOpenAI", FakeChatOpenAI)
        monkeypatch.setattr("agents.registry.InMemorySaver", FakeInMemorySaver)
        monkeypatch.setattr("agents.registry.LangGraphAdapter", FakeLangGraphAdapter)
        monkeypatch.setattr("agents.registry.Agent", FakeBandAgent)
        monkeypatch.setattr(
            "agents.registry.render_system_prompt",
            lambda **kwargs: "rendered system prompt",
            raising=False,
        )

        result = registry.start_agent(
            "agent_a",
            agent_type=AgentType.RESEARCH,
            model_name="test-model",
            system_instructions="agent-specific instructions",
            shutdown_timeout=12.5,
        )
        task = registry._agent_tasks["agent_a"]
        await started.wait()

        assert result is None
        assert registry._agent_tasks == {"agent_a": task}
        assert created["llm_model"] == "test-model"
        assert created["custom_section"] == "agent-specific instructions"
        assert created["agent_kwargs"] == {
            "adapter": created["agent_kwargs"]["adapter"],
            "agent_id": "agent-a-id",
            "api_key": "agent-a-key",
            "ws_url": "wss://example.test/socket",
            "rest_url": "https://example.test",
        }
        assert isinstance(created["agent_kwargs"]["adapter"], FakeLangGraphAdapter)
        assert run_calls == [12.5]
        assert registry._agent_registry["agent_a"].agent_type is AgentType.RESEARCH

        release.set()
        await task
        assert registry._agent_tasks == {}
        assert "Starting agent task 'agent_a'" in caplog.text
        assert "Agent task 'agent_a' stopped" in caplog.text

    asyncio.run(scenario())


def test_start_agent_defaults_to_general_purpose_agent_type(
    monkeypatch: MonkeyPatch,
) -> None:
    async def scenario() -> None:
        registry = build_registry_without_loading_config()
        registry._agent_registry["agent_a"] = AgentEntry(
            agent_definition=AgentDefinition(
                name="agent_a",
                band_agent_id="agent-a-id",
                band_api_key="agent-a-key",
            )
        )
        started = asyncio.Event()
        release = asyncio.Event()

        class FakeChatOpenAI:
            def __init__(self, *, model: str) -> None:
                pass

        class FakeInMemorySaver:
            pass

        class FakeLangGraphAdapter:
            def __init__(self, **kwargs: Any) -> None:
                pass

        class FakeBandAgent:
            @classmethod
            def create(cls, **kwargs: Any) -> "FakeBandAgent":
                return cls()

            async def run(self, shutdown_timeout: float | None = 30.0) -> None:
                started.set()
                await release.wait()

        monkeypatch.setattr("agents.registry.ChatOpenAI", FakeChatOpenAI)
        monkeypatch.setattr("agents.registry.InMemorySaver", FakeInMemorySaver)
        monkeypatch.setattr("agents.registry.LangGraphAdapter", FakeLangGraphAdapter)
        monkeypatch.setattr("agents.registry.Agent", FakeBandAgent)
        monkeypatch.setattr(
            "agents.registry.render_system_prompt",
            lambda **kwargs: "rendered system prompt",
            raising=False,
        )

        registry.start_agent("agent_a")
        task = registry._agent_tasks["agent_a"]
        await started.wait()

        assert registry._agent_registry["agent_a"].agent_type is (
            AgentType.GENERAL_PURPOSE
        )

        release.set()
        await task

    asyncio.run(scenario())


def test_start_agent_rejects_unknown_agent_name() -> None:
    registry = build_registry_without_loading_config()

    with pytest.raises(ValueError, match="agent_a"):
        registry.start_agent("agent_a")


def test_start_agent_rejects_already_running_agent() -> None:
    async def scenario() -> None:
        registry = build_registry_without_loading_config()
        registry._agent_registry["agent_a"] = AgentEntry(
            agent_definition=AgentDefinition(
                name="agent_a",
                band_agent_id="agent-a-id",
                band_api_key="agent-a-key",
            )
        )
        monkeypatch = MonkeyPatch()
        release = asyncio.Event()

        class FakeChatOpenAI:
            def __init__(self, *, model: str) -> None:
                pass

        class FakeInMemorySaver:
            pass

        class FakeLangGraphAdapter:
            def __init__(self, **kwargs: Any) -> None:
                pass

        class FakeBandAgent:
            @classmethod
            def create(cls, **kwargs: Any) -> "FakeBandAgent":
                return cls()

            async def run(self, shutdown_timeout: float | None = 30.0) -> None:
                await release.wait()

        monkeypatch.setattr("agents.registry.ChatOpenAI", FakeChatOpenAI)
        monkeypatch.setattr("agents.registry.InMemorySaver", FakeInMemorySaver)
        monkeypatch.setattr("agents.registry.LangGraphAdapter", FakeLangGraphAdapter)
        monkeypatch.setattr("agents.registry.Agent", FakeBandAgent)
        monkeypatch.setattr(
            "agents.registry.render_system_prompt",
            lambda **kwargs: "rendered system prompt",
            raising=False,
        )

        result = registry.start_agent("agent_a")
        task = registry._agent_tasks["agent_a"]
        try:
            assert result is None
            with pytest.raises(RuntimeError, match="already running"):
                registry.start_agent("agent_a")
        finally:
            release.set()
            await task
            monkeypatch.undo()

    asyncio.run(scenario())


def test_start_agent_returned_task_can_be_cancelled_by_caller() -> None:
    async def scenario() -> None:
        registry = build_registry_without_loading_config()
        registry._agent_registry["agent_a"] = AgentEntry(
            agent_definition=AgentDefinition(
                name="agent_a",
                band_agent_id="agent-a-id",
                band_api_key="agent-a-key",
            )
        )
        monkeypatch = MonkeyPatch()
        started = asyncio.Event()
        cancelled = asyncio.Event()

        class FakeChatOpenAI:
            def __init__(self, *, model: str) -> None:
                pass

        class FakeInMemorySaver:
            pass

        class FakeLangGraphAdapter:
            def __init__(self, **kwargs: Any) -> None:
                pass

        class FakeBandAgent:
            @classmethod
            def create(cls, **kwargs: Any) -> "FakeBandAgent":
                return cls()

            async def run(self, shutdown_timeout: float | None = 30.0) -> None:
                started.set()
                try:
                    await asyncio.Event().wait()
                except asyncio.CancelledError:
                    cancelled.set()
                    raise

        monkeypatch.setattr("agents.registry.ChatOpenAI", FakeChatOpenAI)
        monkeypatch.setattr("agents.registry.InMemorySaver", FakeInMemorySaver)
        monkeypatch.setattr("agents.registry.LangGraphAdapter", FakeLangGraphAdapter)
        monkeypatch.setattr("agents.registry.Agent", FakeBandAgent)
        monkeypatch.setattr(
            "agents.registry.render_system_prompt",
            lambda **kwargs: "rendered system prompt",
            raising=False,
        )

        result = registry.start_agent("agent_a")
        task = registry._agent_tasks["agent_a"]
        await started.wait()

        assert result is None
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task

        assert cancelled.is_set()
        assert task.cancelled()
        assert registry._agent_tasks == {}
        monkeypatch.undo()

    asyncio.run(scenario())


def test_start_agent_logs_agent_name_on_task_failure(
    monkeypatch: MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    async def scenario() -> None:
        caplog.set_level(logging.INFO, logger="agents.registry")
        registry = build_registry_without_loading_config()
        registry._agent_registry["agent_a"] = AgentEntry(
            agent_definition=AgentDefinition(
                name="agent_a",
                band_agent_id="agent-a-id",
                band_api_key="agent-a-key",
            )
        )

        class FakeChatOpenAI:
            def __init__(self, *, model: str) -> None:
                pass

        class FakeInMemorySaver:
            pass

        class FakeLangGraphAdapter:
            def __init__(self, **kwargs: Any) -> None:
                pass

        class FakeBandAgent:
            @classmethod
            def create(cls, **kwargs: Any) -> "FakeBandAgent":
                return cls()

            async def run(self, shutdown_timeout: float | None = 30.0) -> None:
                raise RuntimeError("agent failed")

        monkeypatch.setattr("agents.registry.ChatOpenAI", FakeChatOpenAI)
        monkeypatch.setattr("agents.registry.InMemorySaver", FakeInMemorySaver)
        monkeypatch.setattr("agents.registry.LangGraphAdapter", FakeLangGraphAdapter)
        monkeypatch.setattr("agents.registry.Agent", FakeBandAgent)

        registry.start_agent("agent_a")
        task = registry._agent_tasks["agent_a"]

        with pytest.raises(RuntimeError, match="agent failed"):
            await task

        assert registry._agent_tasks == {}
        assert "Agent task 'agent_a' failed" in caplog.text
        assert "Agent task 'agent_a' stopped" in caplog.text

    asyncio.run(scenario())


def test_start_agent_names_task_and_logs_task_completion(
    monkeypatch: MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    async def scenario() -> None:
        caplog.set_level(logging.INFO, logger="agents.registry")
        registry = build_registry_without_loading_config()
        registry._agent_registry["agent_b"] = AgentEntry(
            agent_definition=AgentDefinition(
                name="agent_b",
                band_agent_id="agent-b-id",
                band_api_key="agent-b-key",
            )
        )

        class FakeChatOpenAI:
            def __init__(self, *, model: str) -> None:
                pass

        class FakeInMemorySaver:
            pass

        class FakeLangGraphAdapter:
            def __init__(self, **kwargs: Any) -> None:
                pass

        class FakeBandAgent:
            @classmethod
            def create(cls, **kwargs: Any) -> "FakeBandAgent":
                return cls()

            async def run(self, shutdown_timeout: float | None = 30.0) -> None:
                return None

        monkeypatch.setattr("agents.registry.ChatOpenAI", FakeChatOpenAI)
        monkeypatch.setattr("agents.registry.InMemorySaver", FakeInMemorySaver)
        monkeypatch.setattr("agents.registry.LangGraphAdapter", FakeLangGraphAdapter)
        monkeypatch.setattr("agents.registry.Agent", FakeBandAgent)

        registry.start_agent("agent_b")
        task = registry._agent_tasks["agent_b"]

        assert task.get_name() == "band-agent-agent_b"

        await task
        await asyncio.sleep(0)

        assert "Agent task 'agent_b' completed" in caplog.text

    asyncio.run(scenario())


def test_start_agent_logs_task_cancellation(
    monkeypatch: MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    async def scenario() -> None:
        caplog.set_level(logging.INFO, logger="agents.registry")
        registry = build_registry_without_loading_config()
        registry._agent_registry["agent_b"] = AgentEntry(
            agent_definition=AgentDefinition(
                name="agent_b",
                band_agent_id="agent-b-id",
                band_api_key="agent-b-key",
            )
        )
        started = asyncio.Event()

        class FakeChatOpenAI:
            def __init__(self, *, model: str) -> None:
                pass

        class FakeInMemorySaver:
            pass

        class FakeLangGraphAdapter:
            def __init__(self, **kwargs: Any) -> None:
                pass

        class FakeBandAgent:
            @classmethod
            def create(cls, **kwargs: Any) -> "FakeBandAgent":
                return cls()

            async def run(self, shutdown_timeout: float | None = 30.0) -> None:
                started.set()
                await asyncio.Event().wait()

        monkeypatch.setattr("agents.registry.ChatOpenAI", FakeChatOpenAI)
        monkeypatch.setattr("agents.registry.InMemorySaver", FakeInMemorySaver)
        monkeypatch.setattr("agents.registry.LangGraphAdapter", FakeLangGraphAdapter)
        monkeypatch.setattr("agents.registry.Agent", FakeBandAgent)

        registry.start_agent("agent_b")
        task = registry._agent_tasks["agent_b"]
        await started.wait()

        task.cancel()
        with suppress(asyncio.CancelledError):
            await task
        await asyncio.sleep(0)

        assert "Agent task 'agent_b' cancelled" in caplog.text

    asyncio.run(scenario())
