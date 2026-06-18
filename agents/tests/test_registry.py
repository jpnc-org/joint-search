import asyncio
import logging
from contextlib import suppress
from pathlib import Path
from typing import Any

import pytest
from pytest import MonkeyPatch

import agents.band.registry as registry_module
from agents.band.registry import (
    AgentDefinition,
    AgentEntry,
    AgentType,
    Registry,
    build_agent_prompt,
    model_name_for_agent_type,
)


def build_registry_without_loading_config() -> Registry:
    registry = object.__new__(Registry)
    registry._agent_registry = {}
    registry._agent_tasks = {}
    registry._ws_url = "wss://example.test/socket"
    registry._rest_url = "https://example.test"
    return registry


def install_fake_langgraph_runtime(
    monkeypatch: MonkeyPatch,
    agent_cls: type,
    created: dict[str, Any] | None = None,
) -> None:
    created_values = created if created is not None else {}

    class FakeChatOpenAI:
        def __init__(self, *, model: str) -> None:
            created_values.setdefault("llm_models", []).append(model)

    class FakeInMemorySaver:
        def __init__(self) -> None:
            created_values.setdefault("checkpointers", []).append(self)

    class FakeLangGraphAdapter:
        def __init__(
            self,
            *,
            llm: FakeChatOpenAI,
            checkpointer: FakeInMemorySaver,
            custom_section: str,
        ) -> None:
            created_values.setdefault("adapters", []).append(self)
            created_values.setdefault("adapter_llms", []).append(llm)
            created_values.setdefault("adapter_checkpointers", []).append(checkpointer)
            created_values.setdefault("custom_sections", []).append(custom_section)

    monkeypatch.setattr("agents.band.registry.ChatOpenAI", FakeChatOpenAI)
    monkeypatch.setattr("agents.band.registry.InMemorySaver", FakeInMemorySaver)
    monkeypatch.setattr("agents.band.registry.LangGraphAdapter", FakeLangGraphAdapter)
    monkeypatch.setattr("agents.band.registry.Agent", agent_cls)


def register_agent(registry: Registry, name: str = "agent_a") -> None:
    registry._agent_registry[name] = AgentEntry(
        agent_definition=AgentDefinition(
            name=name,
            band_agent_id=f"{name}-id",
            band_api_key=f"{name}-key",
        )
    )


def test_registry_does_not_expose_runtime_create_api() -> None:
    assert not hasattr(build_registry_without_loading_config(), "create")


def test_registry_exposes_only_start_agent_for_execution_lifecycle() -> None:
    registry = build_registry_without_loading_config()

    assert hasattr(registry, "start_agent")
    assert not hasattr(registry, "execute_agent")
    assert not hasattr(registry, "stop_agent")
    assert not hasattr(registry, "_run_agent")


def test_registry_constructor_does_not_load_dotenv(monkeypatch: MonkeyPatch) -> None:
    def fake_load_dotenv() -> None:
        raise AssertionError("dotenv should be loaded by main, not Registry")

    monkeypatch.setenv("BAND_WS_URL", "wss://example.test/socket")
    monkeypatch.setenv("BAND_REST_URL", "https://example.test")
    monkeypatch.setattr(
        "agents.band.registry.load_dotenv",
        fake_load_dotenv,
        raising=False,
    )
    monkeypatch.setattr(
        Registry,
        "_load_agent_definitions",
        lambda self: {},
    )

    registry = Registry()

    assert registry._ws_url == "wss://example.test/socket"
    assert registry._rest_url == "https://example.test"


def test_agent_type_values_are_domain_categories() -> None:
    assert AgentType.RESEARCHER.value == "RESEARCHER"
    assert AgentType.GENERAL_PURPOSE.value == "GENERAL_PURPOSE"
    assert AgentType.ORCHESTRATOR.value == "ORCHESTRATOR"


def test_model_name_for_agent_type_covers_all_agent_types() -> None:
    assert set(registry_module.AGENT_TYPE_MODEL_NAMES) == set(AgentType)
    for agent_type in AgentType:
        assert model_name_for_agent_type(agent_type)


def test_model_name_for_agent_type_uses_configured_agent_type_mapping(
    monkeypatch: MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        registry_module,
        "AGENT_TYPE_MODEL_NAMES",
        {
            AgentType.RESEARCHER: "research-model",
            AgentType.GENERAL_PURPOSE: "general-model",
            AgentType.ORCHESTRATOR: "orchestrator-model",
        },
    )

    assert model_name_for_agent_type(AgentType.RESEARCHER) == "research-model"
    assert model_name_for_agent_type(AgentType.GENERAL_PURPOSE) == "general-model"
    assert model_name_for_agent_type(AgentType.ORCHESTRATOR) == "orchestrator-model"


def test_build_agent_prompt_adds_band_tool_call_instructions() -> None:
    prompt = build_agent_prompt("Role-specific instructions.")

    assert "Role-specific instructions." in prompt
    assert "band_send_message" in prompt
    assert "tool call" in prompt
    assert "normal assistant message" in prompt
    assert "plain final text response" in prompt
    assert "mentions" in prompt
    assert "\n\nIn the tool call" in prompt
    assert "chat.\n\n" in prompt


def test_build_agent_prompt_handles_empty_role_instructions() -> None:
    prompt = build_agent_prompt("")

    assert prompt.startswith("Every answer to a Band message")
    assert "band_send_message" in prompt
    assert "\n\n" in prompt
    assert not prompt.startswith(" ")


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


def test_load_agent_definitions_falls_back_to_project_agent_config(
    tmp_path: Path,
    monkeypatch: MonkeyPatch,
) -> None:
    cwd = tmp_path / "repo-root"
    cwd.mkdir()
    project_config_path = tmp_path / "agents" / "agent_config.yaml"
    project_config_path.parent.mkdir()
    project_config_path.write_text(
        """
agent_a:
  agent_id: agent-a-id
  api_key: agent-a-key
""",
        encoding="utf-8",
    )
    monkeypatch.chdir(cwd)
    monkeypatch.setattr(
        registry_module,
        "DEFAULT_AGENT_CONFIG_PATH",
        project_config_path,
    )

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
        "agents.band.registry.load_agent_config",
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
        caplog.set_level(logging.INFO, logger="agents.band.registry")
        registry = build_registry_without_loading_config()
        register_agent(registry)
        created: dict[str, Any] = {"agent_kwargs": []}
        run_calls: list[float | None] = []
        stop_calls: list[float | None] = []
        started = asyncio.Event()

        class FakeBandAgent:
            @classmethod
            def create(cls, **kwargs: Any) -> "FakeBandAgent":
                created["agent_kwargs"].append(kwargs)
                return cls()

            async def run(self, shutdown_timeout: float | None = 30.0) -> None:
                run_calls.append(shutdown_timeout)
                started.set()
                await asyncio.Event().wait()

            async def stop(self, timeout: float | None = None) -> None:  # noqa: ASYNC109
                stop_calls.append(timeout)

        install_fake_langgraph_runtime(monkeypatch, FakeBandAgent, created)
        monkeypatch.setattr(
            "agents.band.registry.render_system_prompt",
            lambda **kwargs: "rendered system prompt",
            raising=False,
        )

        result = registry.start_agent(
            "agent_a",
            agent_type=AgentType.RESEARCHER,
            model_name="test-model",
            system_instructions="agent-specific instructions",
            shutdown_timeout=12.5,
        )
        task = registry._agent_tasks["agent_a"]
        await started.wait()

        assert result is None
        assert registry._agent_tasks == {"agent_a": task}
        assert created["llm_models"] == ["test-model"]
        assert len(created["custom_sections"]) == 1
        assert "agent-specific instructions" in created["custom_sections"][0]
        assert "band_send_message" in created["custom_sections"][0]
        assert "tool call" in created["custom_sections"][0]
        assert created["agent_kwargs"] == [
            {
                "adapter": created["agent_kwargs"][0]["adapter"],
                "agent_id": "agent_a-id",
                "api_key": "agent_a-key",
                "ws_url": "wss://example.test/socket",
                "rest_url": "https://example.test",
            }
        ]
        assert run_calls == [12.5]
        assert registry._agent_registry["agent_a"].agent_type is AgentType.RESEARCHER

        task.cancel()
        with suppress(asyncio.CancelledError):
            await task
        await asyncio.sleep(0)

        assert registry._agent_tasks == {}
        assert stop_calls == [registry_module.AGENT_STOP_TIMEOUT_SECONDS]
        assert "Starting agent task 'agent_a'" in caplog.text
        assert "Agent task 'agent_a' stopped" in caplog.text

    asyncio.run(scenario())


def test_start_agent_uses_agent_type_model_when_model_is_not_overridden(
    monkeypatch: MonkeyPatch,
) -> None:
    async def scenario() -> None:
        monkeypatch.setattr(
            registry_module,
            "AGENT_TYPE_MODEL_NAMES",
            {
                AgentType.RESEARCHER: "research-model",
                AgentType.GENERAL_PURPOSE: "general-model",
                AgentType.ORCHESTRATOR: "orchestrator-model",
            },
        )
        registry = build_registry_without_loading_config()
        register_agent(registry, "research_planner")
        created: dict[str, Any] = {}
        started = asyncio.Event()

        class FakeBandAgent:
            @classmethod
            def create(cls, **kwargs: Any) -> "FakeBandAgent":
                return cls()

            async def run(self, shutdown_timeout: float | None = 30.0) -> None:
                started.set()
                await asyncio.Event().wait()

        install_fake_langgraph_runtime(monkeypatch, FakeBandAgent, created)

        registry.start_agent(
            "research_planner",
            agent_type=AgentType.ORCHESTRATOR,
        )
        task = registry._agent_tasks["research_planner"]
        await started.wait()

        assert created["llm_models"] == ["orchestrator-model"]

        task.cancel()
        with suppress(asyncio.CancelledError):
            await task

    asyncio.run(scenario())


def test_start_agent_reconnects_after_clean_exit_with_fresh_agent_and_stop(
    monkeypatch: MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    async def scenario() -> None:
        caplog.set_level(logging.INFO, logger="agents.band.registry")
        monkeypatch.setattr(registry_module, "AGENT_RECONNECT_BASE_DELAY_SECONDS", 0.0)
        monkeypatch.setattr(registry_module, "AGENT_RECONNECT_MAX_DELAY_SECONDS", 0.0)

        registry = build_registry_without_loading_config()
        register_agent(registry)
        created: dict[str, Any] = {"agent_kwargs": []}
        agents: list[Any] = []
        second_started = asyncio.Event()

        class FakeBandAgent:
            def __init__(self, number: int) -> None:
                self.number = number
                self.stop_calls: list[float | None] = []

            @classmethod
            def create(cls, **kwargs: Any) -> "FakeBandAgent":
                created["agent_kwargs"].append(kwargs)
                agent = cls(len(agents) + 1)
                agents.append(agent)
                return agent

            async def run(self, shutdown_timeout: float | None = 30.0) -> None:
                if self.number == 1:
                    return
                second_started.set()
                await asyncio.Event().wait()

            async def stop(self, timeout: float | None = None) -> None:  # noqa: ASYNC109
                self.stop_calls.append(timeout)

        install_fake_langgraph_runtime(monkeypatch, FakeBandAgent, created)

        registry.start_agent("agent_a")
        task = registry._agent_tasks["agent_a"]
        await second_started.wait()

        assert registry._agent_tasks == {"agent_a": task}
        assert len(agents) == 2
        assert agents[0].stop_calls == [registry_module.AGENT_STOP_TIMEOUT_SECONDS]
        assert created["agent_kwargs"][0] == {
            "adapter": created["agent_kwargs"][0]["adapter"],
            "agent_id": "agent_a-id",
            "api_key": "agent_a-key",
            "ws_url": "wss://example.test/socket",
            "rest_url": "https://example.test",
        }
        assert created["agent_kwargs"][1] == {
            "adapter": created["agent_kwargs"][1]["adapter"],
            "agent_id": "agent_a-id",
            "api_key": "agent_a-key",
            "ws_url": "wss://example.test/socket",
            "rest_url": "https://example.test",
        }
        assert "Agent task 'agent_a' exited cleanly; reconnecting" in caplog.text

        task.cancel()
        with suppress(asyncio.CancelledError):
            await task
        assert registry._agent_tasks == {}

    asyncio.run(scenario())


def test_start_agent_reconnects_after_failure_with_fresh_agent_and_stop(
    monkeypatch: MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    async def scenario() -> None:
        caplog.set_level(logging.INFO, logger="agents.band.registry")
        monkeypatch.setattr(registry_module, "AGENT_RECONNECT_BASE_DELAY_SECONDS", 0.0)
        monkeypatch.setattr(registry_module, "AGENT_RECONNECT_MAX_DELAY_SECONDS", 0.0)

        registry = build_registry_without_loading_config()
        register_agent(registry)
        agents: list[Any] = []
        second_started = asyncio.Event()

        class FakeBandAgent:
            def __init__(self, number: int) -> None:
                self.number = number
                self.stop_calls: list[float | None] = []

            @classmethod
            def create(cls, **kwargs: Any) -> "FakeBandAgent":
                agent = cls(len(agents) + 1)
                agents.append(agent)
                return agent

            async def run(self, shutdown_timeout: float | None = 30.0) -> None:
                if self.number == 1:
                    raise RuntimeError("agent failed")
                second_started.set()
                await asyncio.Event().wait()

            async def stop(self, timeout: float | None = None) -> None:  # noqa: ASYNC109
                self.stop_calls.append(timeout)

        install_fake_langgraph_runtime(monkeypatch, FakeBandAgent)

        registry.start_agent("agent_a")
        task = registry._agent_tasks["agent_a"]
        await second_started.wait()

        assert registry._agent_tasks == {"agent_a": task}
        assert len(agents) == 2
        assert agents[0].stop_calls == [registry_module.AGENT_STOP_TIMEOUT_SECONDS]
        assert "Agent task 'agent_a' failed; reconnecting" in caplog.text

        task.cancel()
        with suppress(asyncio.CancelledError):
            await task
        assert registry._agent_tasks == {}

    asyncio.run(scenario())


def test_start_agent_uses_exponential_reconnect_backoff(
    monkeypatch: MonkeyPatch,
) -> None:
    async def scenario() -> None:
        monkeypatch.setattr(registry_module, "AGENT_RECONNECT_BASE_DELAY_SECONDS", 3.0)
        monkeypatch.setattr(registry_module, "AGENT_RECONNECT_MAX_DELAY_SECONDS", 5.0)

        sleep_calls: list[float] = []

        async def fake_sleep(delay: float) -> None:
            sleep_calls.append(delay)

        monkeypatch.setattr(registry_module.asyncio, "sleep", fake_sleep)

        registry = build_registry_without_loading_config()
        register_agent(registry)
        agents: list[Any] = []
        third_started = asyncio.Event()

        class FakeBandAgent:
            def __init__(self, number: int) -> None:
                self.number = number

            @classmethod
            def create(cls, **kwargs: Any) -> "FakeBandAgent":
                agent = cls(len(agents) + 1)
                agents.append(agent)
                return agent

            async def run(self, shutdown_timeout: float | None = 30.0) -> None:
                if self.number < 3:
                    return
                third_started.set()
                await asyncio.Event().wait()

            async def stop(self, timeout: float | None = None) -> None:  # noqa: ASYNC109
                return None

        install_fake_langgraph_runtime(monkeypatch, FakeBandAgent)

        registry.start_agent("agent_a")
        task = registry._agent_tasks["agent_a"]
        await third_started.wait()

        assert sleep_calls == [3.0, 5.0]
        assert len(agents) == 3

        task.cancel()
        with suppress(asyncio.CancelledError):
            await task

    asyncio.run(scenario())


def test_start_agent_defaults_to_general_purpose_agent_type(
    monkeypatch: MonkeyPatch,
) -> None:
    async def scenario() -> None:
        registry = build_registry_without_loading_config()
        register_agent(registry)
        started = asyncio.Event()

        class FakeBandAgent:
            @classmethod
            def create(cls, **kwargs: Any) -> "FakeBandAgent":
                return cls()

            async def run(self, shutdown_timeout: float | None = 30.0) -> None:
                started.set()
                await asyncio.Event().wait()

        install_fake_langgraph_runtime(monkeypatch, FakeBandAgent)

        registry.start_agent("agent_a")
        task = registry._agent_tasks["agent_a"]
        await started.wait()

        assert registry._agent_registry["agent_a"].agent_type is (
            AgentType.GENERAL_PURPOSE
        )

        task.cancel()
        with suppress(asyncio.CancelledError):
            await task

    asyncio.run(scenario())


def test_start_agent_rejects_unknown_agent_name() -> None:
    registry = build_registry_without_loading_config()

    with pytest.raises(ValueError, match="agent_a"):
        registry.start_agent("agent_a")


def test_start_agent_rejects_already_running_agent() -> None:
    async def scenario() -> None:
        registry = build_registry_without_loading_config()
        register_agent(registry)
        monkeypatch = MonkeyPatch()
        started = asyncio.Event()

        class FakeBandAgent:
            @classmethod
            def create(cls, **kwargs: Any) -> "FakeBandAgent":
                return cls()

            async def run(self, shutdown_timeout: float | None = 30.0) -> None:
                started.set()
                await asyncio.Event().wait()

        install_fake_langgraph_runtime(monkeypatch, FakeBandAgent)

        result = registry.start_agent("agent_a")
        task = registry._agent_tasks["agent_a"]
        await started.wait()
        try:
            assert result is None
            with pytest.raises(RuntimeError, match="already running"):
                registry.start_agent("agent_a")
        finally:
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task
            monkeypatch.undo()

    asyncio.run(scenario())


def test_start_agent_returned_task_can_be_cancelled_by_caller() -> None:
    async def scenario() -> None:
        registry = build_registry_without_loading_config()
        register_agent(registry)
        monkeypatch = MonkeyPatch()
        started = asyncio.Event()
        cancelled = asyncio.Event()
        stop_calls: list[float | None] = []

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

            async def stop(self, timeout: float | None = None) -> None:  # noqa: ASYNC109
                stop_calls.append(timeout)

        install_fake_langgraph_runtime(monkeypatch, FakeBandAgent)

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
        assert stop_calls == [registry_module.AGENT_STOP_TIMEOUT_SECONDS]
        monkeypatch.undo()

    asyncio.run(scenario())


def test_start_agent_names_task_and_logs_task_cancellation(
    monkeypatch: MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    async def scenario() -> None:
        caplog.set_level(logging.INFO, logger="agents.band.registry")
        registry = build_registry_without_loading_config()
        register_agent(registry, "agent_b")
        started = asyncio.Event()

        class FakeBandAgent:
            @classmethod
            def create(cls, **kwargs: Any) -> "FakeBandAgent":
                return cls()

            async def run(self, shutdown_timeout: float | None = 30.0) -> None:
                started.set()
                await asyncio.Event().wait()

        install_fake_langgraph_runtime(monkeypatch, FakeBandAgent)

        registry.start_agent("agent_b")
        task = registry._agent_tasks["agent_b"]
        await started.wait()

        assert task.get_name() == "band-agent-agent_b"

        task.cancel()
        with suppress(asyncio.CancelledError):
            await task
        await asyncio.sleep(0)

        assert "Agent task 'agent_b' cancelled" in caplog.text

    asyncio.run(scenario())


def test_patch_band_local_runtime_is_idempotent_and_owns_reconnect() -> None:
    async def scenario() -> None:
        class FakePHXChannelsClient:
            def __init__(self) -> None:
                self.auto_reconnect = True
                self._supervisor_task: asyncio.Task[None] | None = None

            async def run_forever(self) -> None:
                raise AssertionError("original run_forever should be patched")

        class FakeWebSocketClient:
            def __init__(self) -> None:
                self.client: FakePHXChannelsClient | None = None

            async def __aenter__(self) -> "FakeWebSocketClient":
                self.client = FakePHXChannelsClient()
                self.client.auto_reconnect = True
                return self

        class FakeStreamingClient:
            WebSocketClient = FakeWebSocketClient
            PHXChannelsClient = FakePHXChannelsClient

        registry_module._patch_band_local_runtime(FakeStreamingClient)
        first_aenter = FakeWebSocketClient.__aenter__
        first_run_forever = FakePHXChannelsClient.run_forever
        registry_module._patch_band_local_runtime(FakeStreamingClient)

        assert FakeWebSocketClient.__aenter__ is first_aenter
        assert FakePHXChannelsClient.run_forever is first_run_forever

        websocket_client = FakeWebSocketClient()
        await websocket_client.__aenter__()

        assert websocket_client.client is not None
        assert websocket_client.client.auto_reconnect is False

        completed = asyncio.Event()

        async def supervisor() -> None:
            completed.set()

        phx_client = FakePHXChannelsClient()
        phx_client._supervisor_task = asyncio.create_task(supervisor())
        await phx_client.run_forever()

        assert completed.is_set()
        with pytest.raises(RuntimeError, match="Client is not connected"):
            await FakePHXChannelsClient().run_forever()

    asyncio.run(scenario())


def test_start_agents_starts_all_specs_and_awaits_tasks(
    monkeypatch: MonkeyPatch,
) -> None:
    async def scenario() -> None:
        registry = build_registry_without_loading_config()
        register_agent(registry, "research_planner")
        register_agent(registry, "researcher_1")

        started: list[str] = []

        class FakeBandAgent:
            @classmethod
            def create(cls, **kwargs: Any) -> "FakeBandAgent":
                return cls()

            async def run(self, shutdown_timeout: float | None = 30.0) -> None:
                started.append("run")
                await asyncio.Event().wait()

        install_fake_langgraph_runtime(monkeypatch, FakeBandAgent)

        def fake_iter_agent_specs() -> tuple[Any, ...]:
            from agents.band.registry import AgentSpec, AgentType

            return (
                AgentSpec(
                    name="research_planner",
                    agent_type=AgentType.ORCHESTRATOR,
                    instructions="Plan.",
                ),
                AgentSpec(
                    name="researcher_1",
                    agent_type=AgentType.RESEARCHER,
                    instructions="Research.",
                ),
            )

        monkeypatch.setattr(registry_module, "iter_agent_specs", fake_iter_agent_specs)

        run_task = asyncio.create_task(registry.start_agents())
        await asyncio.sleep(0.05)

        assert set(registry._agent_tasks) == {"research_planner", "researcher_1"}
        assert len(started) == 2

        for task in registry._agent_tasks.values():
            task.cancel()
        run_task.cancel()
        with suppress(asyncio.CancelledError):
            await run_task

    asyncio.run(scenario())
