import asyncio
from typing import Any

from agents.main import AGENT_SPECS, BAND_REPLY_INSTRUCTIONS, AgentSpec, run_agents
from agents.registry import AgentType


def test_default_agent_specs_use_single_line_instructions() -> None:
    assert AGENT_SPECS[0].instructions == (
        "You are a very experienced developer, mostly working with the Python and "
        "C++ programming languages. You are very helpful and always provide "
        f"detailed explanations. {BAND_REPLY_INSTRUCTIONS}"
    )
    assert AGENT_SPECS[1].instructions == (
        "You are a very experienced writer, mostly working with the English and "
        "Russian languages. You are a little bit rude, but still very helpful. "
        f"{BAND_REPLY_INSTRUCTIONS}"
    )


def test_default_agent_specs_require_band_send_message_tool() -> None:
    for spec in AGENT_SPECS:
        assert "band_send_message" in spec.instructions
        assert "plain final text response" in spec.instructions


def test_run_agents_starts_specs_and_waits_for_registry_tasks() -> None:
    async def scenario() -> None:
        completed: list[str] = []

        async def task_body(name: str) -> None:
            completed.append(name)

        class FakeRegistry:
            def __init__(self) -> None:
                self._agent_tasks: dict[str, asyncio.Task[None]] = {}
                self.start_calls: list[dict[str, Any]] = []

            def start_agent(
                self,
                name: str,
                *,
                agent_type: AgentType = AgentType.GENERAL_PURPOSE,
                model_name: str = "test-model",
                system_instructions: str = "",
                shutdown_timeout: float | None = 30.0,
            ) -> None:
                self.start_calls.append(
                    {
                        "name": name,
                        "agent_type": agent_type,
                        "model_name": model_name,
                        "system_instructions": system_instructions,
                        "shutdown_timeout": shutdown_timeout,
                    }
                )
                self._agent_tasks[name] = asyncio.create_task(task_body(name))

        registry = FakeRegistry()
        specs = (
            AgentSpec(
                name="agent_a",
                agent_type=AgentType.RESEARCH,
                instructions="Research instructions.",
            ),
            AgentSpec(
                name="agent_b",
                agent_type=AgentType.GENERAL_PURPOSE,
                instructions="General instructions.",
            ),
        )

        await run_agents(
            registry,
            specs=specs,
            model_name="test-model",
            shutdown_timeout=12.5,
        )

        assert registry.start_calls == [
            {
                "name": "agent_a",
                "agent_type": AgentType.RESEARCH,
                "model_name": "test-model",
                "system_instructions": "Research instructions.",
                "shutdown_timeout": 12.5,
            },
            {
                "name": "agent_b",
                "agent_type": AgentType.GENERAL_PURPOSE,
                "model_name": "test-model",
                "system_instructions": "General instructions.",
                "shutdown_timeout": 12.5,
            },
        ]
        assert completed == ["agent_a", "agent_b"]

    asyncio.run(scenario())


def test_run_agents_returns_when_no_tasks_are_started() -> None:
    async def scenario() -> None:
        class FakeRegistry:
            _agent_tasks: dict[str, asyncio.Task[None]] = {}

            def start_agent(
                self,
                name: str,
                *,
                agent_type: AgentType = AgentType.GENERAL_PURPOSE,
                model_name: str = "test-model",
                system_instructions: str = "",
                shutdown_timeout: float | None = 30.0,
            ) -> None:
                raise AssertionError("start_agent should not be called")

        await run_agents(FakeRegistry(), specs=())

    asyncio.run(scenario())
