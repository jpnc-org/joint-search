import asyncio
import subprocess
import sys
from pathlib import Path
from typing import Any

from pytest import MonkeyPatch

import agents.main as main_module


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


def test_main_loads_dotenv_creates_registry_and_starts_agents(
    monkeypatch: MonkeyPatch,
) -> None:
    async def scenario() -> None:
        calls: list[str] = []

        monkeypatch.setattr(
            main_module,
            "load_dotenv",
            lambda *args, **kwargs: calls.append("dotenv"),
            raising=False,
        )

        registries: list[Any] = []

        class FakeRegistry:
            def __init__(self) -> None:
                calls.append("registry")
                registries.append(self)

            async def start_agents(self) -> None:
                calls.append("start_agents")

        monkeypatch.setattr(main_module, "Registry", FakeRegistry)

        await main_module.main()

        assert calls == ["dotenv", "registry", "start_agents"]

    asyncio.run(scenario())
