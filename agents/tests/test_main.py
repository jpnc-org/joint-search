import asyncio
import subprocess
import sys
from pathlib import Path
from typing import Any

from pytest import MonkeyPatch

import agents.main as main_module
from agents.band.registry import AgentSpec, AgentType


def test_main_imports_when_script_directory_is_first_on_path() -> None:
    code = """
import sys
from pathlib import Path

sys.path.insert(0, str(Path("src/agents").resolve()))
sys.path.insert(1, str(Path("src").resolve()))

import agents.main

print("ok")
"""
    result = subprocess.run(
        [sys.executable, "-c", code],
        cwd=Path(__file__).resolve().parents[1],
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr
    assert "ok" in result.stdout


def test_main_loads_dotenv_loads_agents_starts_specs_and_awaits_tasks(
    monkeypatch: MonkeyPatch,
) -> None:
    async def scenario() -> None:
        calls: list[str] = []

        monkeypatch.setattr(
            main_module,
            "load_dotenv",
            lambda: calls.append("dotenv"),
            raising=False,
        )
        monkeypatch.setattr(
            main_module,
            "load_default_agents",
            lambda: calls.append("load"),
        )

        def fake_iter_agent_specs() -> tuple[AgentSpec, ...]:
            calls.append("iter")
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

        monkeypatch.setattr(main_module, "iter_agent_specs", fake_iter_agent_specs)

        gathered: list[str] = []

        async def fake_gather(*tasks: asyncio.Task[None]) -> None:
            gathered.extend(t.get_name() for t in tasks)
            for t in tasks:
                await t

        monkeypatch.setattr(main_module.asyncio, "gather", fake_gather)

        registries: list[Any] = []

        class FakeRegistry:
            def __init__(self) -> None:
                calls.append("registry")
                self._agent_tasks: dict[str, asyncio.Task[None]] = {}
                self.start_calls: list[dict[str, Any]] = []
                registries.append(self)

            def start_agent(
                self,
                name: str,
                *,
                agent_type: AgentType = AgentType.GENERAL_PURPOSE,
                model_name: str | None = None,
                system_instructions: str = "",
                shutdown_timeout: float | None = 30.0,
            ) -> None:
                self.start_calls.append(
                    {
                        "name": name,
                        "agent_type": agent_type,
                        "system_instructions": system_instructions,
                    }
                )

                async def body() -> None:
                    return

                self._agent_tasks[name] = asyncio.create_task(body(), name=name)

        monkeypatch.setattr(main_module, "Registry", FakeRegistry)

        await main_module.main()

        assert calls == ["dotenv", "load", "registry", "iter"]
        registry = registries[0]
        assert [c["name"] for c in registry.start_calls] == [
            "research_planner",
            "researcher_1",
        ]
        assert registry.start_calls[0]["agent_type"] is AgentType.ORCHESTRATOR
        assert registry.start_calls[0]["system_instructions"] == "Plan."
        assert registry.start_calls[1]["agent_type"] is AgentType.RESEARCHER
        assert registry.start_calls[1]["system_instructions"] == "Research."
        assert gathered == ["research_planner", "researcher_1"]

    asyncio.run(scenario())


def test_main_starts_nothing_when_no_specs_registered(
    monkeypatch: MonkeyPatch,
) -> None:
    async def scenario() -> None:
        monkeypatch.setattr(main_module, "load_dotenv", lambda: None, raising=False)
        monkeypatch.setattr(main_module, "load_default_agents", lambda: None)
        monkeypatch.setattr(main_module, "iter_agent_specs", lambda: ())

        class FakeRegistry:
            def __init__(self) -> None:
                self._agent_tasks: dict[str, asyncio.Task[None]] = {}

            def start_agent(
                self,
                name: str,
                *,
                agent_type: AgentType = AgentType.GENERAL_PURPOSE,
                model_name: str | None = None,
                system_instructions: str = "",
                shutdown_timeout: float | None = 30.0,
            ) -> None:
                raise AssertionError("start_agent should not be called")

        monkeypatch.setattr(main_module, "Registry", FakeRegistry)

        async def fake_gather(*tasks: asyncio.Task[None]) -> None:
            raise AssertionError("gather should not be called")

        monkeypatch.setattr(main_module.asyncio, "gather", fake_gather)

        await main_module.main()

    asyncio.run(scenario())
