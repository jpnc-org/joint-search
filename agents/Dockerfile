FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1
ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy

COPY pyproject.toml uv.lock README.md ./
COPY src ./src

RUN uv sync --frozen --no-dev

EXPOSE 8001

CMD ["uv", "run", "--no-sync", "uvicorn", "agents.api:app", "--host", "0.0.0.0", "--port", "8001"]
