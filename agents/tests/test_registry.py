from pathlib import Path
from typing import Any

import pytest
from pytest import MonkeyPatch

from agents.registry import AgentDefinition, Registry


def test_registry_does_not_expose_runtime_create_api() -> None:
    assert not hasattr(Registry(), "create")


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

    registry = Registry()

    loaded = registry._load_agent_definitions(config_path)

    assert loaded == registry.available_agents
    assert set(registry.available_agents) == {"agent_a", "agent_b"}
    assert registry.available_agents["agent_a"].name == "agent_a"
    assert registry.available_agents["agent_a"].band_agent_id == "agent-a-id"
    assert registry.available_agents["agent_a"].band_api_key == "agent-a-key"
    assert registry.available_agents["agent_b"].name == "agent_b"
    assert registry.available_agents["agent_b"].band_agent_id == "agent-b-id"
    assert registry.available_agents["agent_b"].band_api_key == "agent-b-key"


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

    registry = Registry()

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

    registry = Registry()

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

    registry = Registry()
    registry.available_agents["existing"] = AgentDefinition(
        name="existing",
        band_agent_id="existing-id",
        band_api_key="existing-key",
    )

    loaded = registry._load_agent_definitions(config_path)

    assert loaded == {}
    assert registry.available_agents == {}


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

    registry = Registry()

    with pytest.raises(ValueError, match="agent_a"):
        registry._load_agent_definitions(config_path)


def test_load_agent_definitions_rejects_non_mapping_file(tmp_path: Path) -> None:
    config_path = tmp_path / "agent_config.yaml"
    config_path.write_text("- agent_a\n", encoding="utf-8")

    registry = Registry()

    with pytest.raises(ValueError, match="YAML mapping"):
        registry._load_agent_definitions(config_path)


def test_load_agent_definitions_rejects_non_mapping_agent_entry(
    tmp_path: Path,
) -> None:
    config_path = tmp_path / "agent_config.yaml"
    config_path.write_text("agent_a: agent-a-id\n", encoding="utf-8")

    registry = Registry()

    with pytest.raises(ValueError, match="agent_a"):
        registry._load_agent_definitions(config_path)


@pytest.mark.asyncio
async def test_execute_agent_builds_and_runs_langgraph_agent(
    monkeypatch: MonkeyPatch,
) -> None:
    registry = Registry()
    registry.available_agents["agent_a"] = AgentDefinition(
        name="agent_a",
        band_agent_id="agent-a-id",
        band_api_key="agent-a-key",
    )
    created: dict[str, Any] = {}
    run_calls: list[float | None] = []

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

    monkeypatch.setattr("agents.registry.ChatOpenAI", FakeChatOpenAI)
    monkeypatch.setattr("agents.registry.InMemorySaver", FakeInMemorySaver)
    monkeypatch.setattr("agents.registry.LangGraphAdapter", FakeLangGraphAdapter)
    monkeypatch.setattr("agents.registry.Agent", FakeBandAgent)
    monkeypatch.setenv("BAND_WS_URL", "wss://example.test/socket")
    monkeypatch.setenv("BAND_REST_URL", "https://example.test")

    await registry.execute_agent(
        "agent_a",
        model_name="test-model",
        custom_section="agent-specific instructions",
        shutdown_timeout=12.5,
    )

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


@pytest.mark.asyncio
async def test_execute_agent_omits_unset_band_urls(
    monkeypatch: MonkeyPatch,
) -> None:
    registry = Registry()
    registry.available_agents["agent_a"] = AgentDefinition(
        name="agent_a",
        band_agent_id="agent-a-id",
        band_api_key="agent-a-key",
    )
    created: dict[str, Any] = {}

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
            created["agent_kwargs"] = kwargs
            return cls()

        async def run(self, shutdown_timeout: float | None = 30.0) -> None:
            pass

    monkeypatch.setattr("agents.registry.ChatOpenAI", FakeChatOpenAI)
    monkeypatch.setattr("agents.registry.InMemorySaver", FakeInMemorySaver)
    monkeypatch.setattr("agents.registry.LangGraphAdapter", FakeLangGraphAdapter)
    monkeypatch.setattr("agents.registry.Agent", FakeBandAgent)
    monkeypatch.delenv("BAND_WS_URL", raising=False)
    monkeypatch.delenv("BAND_REST_URL", raising=False)

    await registry.execute_agent("agent_a")

    assert "ws_url" not in created["agent_kwargs"]
    assert "rest_url" not in created["agent_kwargs"]


@pytest.mark.asyncio
async def test_execute_agent_rejects_unknown_agent_name() -> None:
    registry = Registry()

    with pytest.raises(ValueError, match="agent_a"):
        await registry.execute_agent("agent_a")
