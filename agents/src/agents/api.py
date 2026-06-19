from __future__ import annotations

import asyncio
import os
from collections.abc import AsyncIterator, Callable
from contextlib import AbstractAsyncContextManager, asynccontextmanager, suppress

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from agents.band.registry import Registry
from agents.research_request_completions import (
    ResearchRequestCompletion,
    wait_for_research_request_completion,
)
from agents.research_room import AGENTS_PROJECT_ROOT, create_research_room

DEFAULT_RESEARCH_TIMEOUT_SECONDS = 900.0


class ResearchRequest(BaseModel):
    request_id: str
    task: str


class ResearchResponse(BaseModel):
    request_id: str
    answer: str
    status: str
    source: str


def create_app(
    *,
    load_environment: bool = True,
    start_agent_runner: bool = True,
) -> FastAPI:
    """Create the FastAPI app used by the backend-facing agents API."""

    if load_environment:
        load_dotenv(dotenv_path=AGENTS_PROJECT_ROOT / ".env")

    api = FastAPI(
        title="Agents API",
        lifespan=_build_lifespan(start_agent_runner=start_agent_runner),
    )

    @api.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @api.post("/research", response_model=ResearchResponse)
    async def research(request: ResearchRequest) -> ResearchResponse:
        return await run_research_request(request)

    return api


def _build_lifespan(
    *,
    start_agent_runner: bool,
) -> Callable[[FastAPI], AbstractAsyncContextManager[None]]:
    @asynccontextmanager
    async def lifespan(api: FastAPI) -> AsyncIterator[None]:
        runner_task = None
        if start_agent_runner:
            registry = Registry()
            runner_task = api.state.agent_runner_task = asyncio.create_task(
                registry.start_agents(),
                name="agents-api-runner",
            )
            await asyncio.sleep(0)

        try:
            yield
        finally:
            if runner_task is not None:
                runner_task.cancel()
                with suppress(asyncio.CancelledError):
                    await runner_task

    return lifespan


async def run_research_request(request: ResearchRequest) -> ResearchResponse:
    """Create a Band research room and wait for the agent final-answer tool."""

    request_id = _normalize_non_empty(request.request_id, "request_id")
    task = _normalize_non_empty(request.task, "task")
    band_agent_api_key = _required_env("BAND_AGENT_API_KEY")
    band_rest_url = _required_env("BAND_REST_URL")
    agent_config_path = os.getenv("AGENT_CONFIG_PATH", ".")
    max_wait_seconds = _research_timeout_seconds()

    try:
        await create_research_room(
            task=task,
            band_agent_api_key=band_agent_api_key,
            band_rest_url=band_rest_url,
            agent_config_path=agent_config_path,
            task_id=request_id,
        )
        completion = await wait_for_research_request_completion(
            request_id,
            max_wait_seconds=max_wait_seconds,
        )
    except TimeoutError as exc:
        raise HTTPException(
            status_code=504,
            detail=f"Research request '{request_id}' timed out.",
        ) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return _build_research_response(completion)


def _build_research_response(
    completion: ResearchRequestCompletion,
) -> ResearchResponse:
    return ResearchResponse(
        request_id=completion.request_id,
        answer=completion.answer,
        status=completion.status,
        source=completion.source,
    )


def _normalize_non_empty(value: str, field_name: str) -> str:
    normalized_value = value.strip()
    if not normalized_value:
        raise HTTPException(status_code=422, detail=f"{field_name} must not be empty.")
    return normalized_value


def _required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise HTTPException(status_code=500, detail=f"{name} is not configured.")
    return value


def _research_timeout_seconds() -> float:
    raw_timeout = os.getenv("AGENTS_RESEARCH_TIMEOUT_SECONDS", "").strip()
    if not raw_timeout:
        return DEFAULT_RESEARCH_TIMEOUT_SECONDS

    try:
        timeout_seconds = float(raw_timeout)
    except ValueError as exc:
        raise HTTPException(
            status_code=500,
            detail="AGENTS_RESEARCH_TIMEOUT_SECONDS must be a number.",
        ) from exc

    if timeout_seconds <= 0:
        raise HTTPException(
            status_code=500,
            detail="AGENTS_RESEARCH_TIMEOUT_SECONDS must be greater than zero.",
        )

    return timeout_seconds


app = create_app()
