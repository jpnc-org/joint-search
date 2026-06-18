from __future__ import annotations

import importlib
import sys

import pytest
from pytest import MonkeyPatch

import agents.band.registry as registry_module
from agents.band.registry import AgentSpec, AgentType, RegistryAgent, agent


def clear_agent_specs(monkeypatch: MonkeyPatch) -> None:
    monkeypatch.setattr(registry_module, "_agent_specs", {})


def test_agent_type_has_orchestrator_category() -> None:
    assert AgentType.ORCHESTRATOR.value == "ORCHESTRATOR"


def test_agent_decorator_registers_one_name(monkeypatch: MonkeyPatch) -> None:
    clear_agent_specs(monkeypatch)

    @agent(names=("example_agent",), agent_type=AgentType.RESEARCHER)
    class ExampleAgent(RegistryAgent):
        @classmethod
        def instructions(cls) -> str:
            return "Research instructions."

    assert registry_module.iter_agent_specs() == (
        AgentSpec(
            name="example_agent",
            agent_type=AgentType.RESEARCHER,
            instructions="Research instructions.",
        ),
    )
    assert ExampleAgent.instructions() == "Research instructions."


def test_agent_decorator_registers_multiple_names(
    monkeypatch: MonkeyPatch,
) -> None:
    clear_agent_specs(monkeypatch)

    @agent(names=("research_a", "research_b"), agent_type=AgentType.RESEARCHER)
    class ResearchAgent(RegistryAgent):
        @classmethod
        def instructions(cls) -> str:
            return "Shared research instructions."

    assert registry_module.iter_agent_specs() == (
        AgentSpec(
            name="research_a",
            agent_type=AgentType.RESEARCHER,
            instructions="Shared research instructions.",
        ),
        AgentSpec(
            name="research_b",
            agent_type=AgentType.RESEARCHER,
            instructions="Shared research instructions.",
        ),
    )
    assert ResearchAgent.instructions() == "Shared research instructions."


def test_undecorated_registry_agent_subclass_does_not_register(
    monkeypatch: MonkeyPatch,
) -> None:
    clear_agent_specs(monkeypatch)

    class ExampleAgent(RegistryAgent):
        @classmethod
        def instructions(cls) -> str:
            return "Research instructions."

    assert ExampleAgent.instructions() == "Research instructions."
    assert registry_module.iter_agent_specs() == ()


def test_agent_decorator_rejects_empty_names(
    monkeypatch: MonkeyPatch,
) -> None:
    clear_agent_specs(monkeypatch)

    with pytest.raises(ValueError, match="at least one"):

        @agent(names=(), agent_type=AgentType.RESEARCHER)
        class EmptyNamesAgent(RegistryAgent):
            pass


def test_agent_decorator_rejects_empty_name_strings(
    monkeypatch: MonkeyPatch,
) -> None:
    clear_agent_specs(monkeypatch)

    with pytest.raises(ValueError, match="non-empty"):

        @agent(names=("example_agent", " "), agent_type=AgentType.RESEARCHER)
        class EmptyNameAgent(RegistryAgent):
            pass


def test_agent_decorator_rejects_duplicate_names(
    monkeypatch: MonkeyPatch,
) -> None:
    clear_agent_specs(monkeypatch)

    @agent(names=("example_agent",), agent_type=AgentType.RESEARCHER)
    class ExampleAgent(RegistryAgent):
        @classmethod
        def instructions(cls) -> str:
            return "Research instructions."

    with pytest.raises(ValueError, match="already registered"):

        @agent(names=("example_agent",), agent_type=AgentType.GENERAL_PURPOSE)
        class DuplicateAgent(RegistryAgent):
            @classmethod
            def instructions(cls) -> str:
                return "General instructions."


def test_agent_decorator_rejects_empty_instructions(
    monkeypatch: MonkeyPatch,
) -> None:
    clear_agent_specs(monkeypatch)

    with pytest.raises(ValueError, match="instructions"):

        @agent(names=("example_agent",), agent_type=AgentType.RESEARCHER)
        class EmptyPromptAgent(RegistryAgent):
            @classmethod
            def instructions(cls) -> str:
                return " "


def test_decorated_registry_agent_can_add_agent_specific_methods(
    monkeypatch: MonkeyPatch,
) -> None:
    clear_agent_specs(monkeypatch)

    @agent(names=("research_planner",), agent_type=AgentType.ORCHESTRATOR)
    class ResearchPlanner(RegistryAgent):
        @classmethod
        def instructions(cls) -> str:
            return "Planning instructions."

        @staticmethod
        def default_subtopic_count() -> int:
            return 5

    assert ResearchPlanner.default_subtopic_count() == 5
    assert registry_module.iter_agent_specs() == (
        AgentSpec(
            name="research_planner",
            agent_type=AgentType.ORCHESTRATOR,
            instructions="Planning instructions.",
        ),
    )


def import_agent_module(monkeypatch: MonkeyPatch, module_name: str) -> None:
    for key in list(sys.modules):
        if key.startswith("agents.definitions"):
            monkeypatch.delitem(sys.modules, key, raising=False)
    importlib.import_module(module_name)


def test_all_top_level_agent_modules_register_default_specs(
    monkeypatch: MonkeyPatch,
) -> None:
    clear_agent_specs(monkeypatch)

    for module_name in (
        "agents.definitions",
        "agents.definitions.research_planner",
        "agents.definitions.researcher",
    ):
        monkeypatch.delitem(sys.modules, module_name, raising=False)

    importlib.import_module("agents.definitions")

    specs = registry_module.iter_agent_specs()

    assert [spec.name for spec in specs] == [
        "research_planner",
        "researcher_1",
        "researcher_2",
        "researcher_3",
    ]
    assert specs[0].agent_type is AgentType.ORCHESTRATOR
    assert "Break the user's question into researchable subtopics" in (
        specs[0].instructions
    )
    assert "do not research the subtopics yourself" in specs[0].instructions
    for spec in specs[1:]:
        assert spec.agent_type is AgentType.RESEARCHER
        assert "research the subtopics assigned to you" in spec.instructions
    for spec in specs:
        assert "\n\n" in spec.instructions
        assert not spec.instructions.startswith(" ")
        assert "band_send_message" not in spec.instructions
        assert "tool call" not in spec.instructions
