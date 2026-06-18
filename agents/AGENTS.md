# AGENTS.md

## Scope

These instructions apply to the Python UV project in this `agents/` directory.
They extend the repository-level `../AGENTS.md` instructions.

## Project Commands

Run commands from this directory:

```bash
cd /Users/happs/code/joint-search/agents
```

Use `uv` for dependency management and command execution:

```bash
uv sync
uv run ruff format --check .
uv run ruff check .
uv run pyright .
uv run pytest
```

Use this command when formatting is intended:

```bash
uv run ruff format .
```

## Workflow

- Use test-driven development for production code changes.
- Add or update tests under `tests/` before changing behavior.
- Run the relevant failing test first, then implement the smallest code change.
- Re-run the relevant test and the applicable quality gates before finishing.
- For docs-only or configuration-only changes, tests may be skipped if there is no
  relevant runtime behavior to exercise; still run formatting or validation gates
  when applicable.

## Dependencies

- Add runtime dependencies with `uv add`.
- Add quality-gate and test-only dependencies with `uv add --dev`.
- Do not manually edit `uv.lock`; let `uv` update it.

## Quality Gates

The default gates for this project are:

```bash
uv run ruff format --check .
uv run ruff check .
uv run pyright .
uv run pytest
```

If a gate cannot be run, report the exact command and reason.

## Python Standards

- Target Python 3.13.
- Keep modules importable without requiring network access or real API keys.
- Mock external services in tests.
- Do not run agent loops, websocket connections, or live API calls in unit tests.
- Prefer small pure functions around prompt construction, config handling, and
  request payload construction so behavior can be tested directly.
- Keep scripts runnable with `uv run python <script>.py`.

## Environment

- Read secrets from environment variables or local `.env` files.
- Do not commit real API keys, tokens, or agent credentials.
- Keep `.env.example` updated when adding or renaming required environment
  variables.
