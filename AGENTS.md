# AGENTS.md

## Workflow

Agents must use test-driven development for code changes:

1. Write or update tests that describe the required behavior before changing production code.
2. Run the relevant tests and confirm they fail for the expected reason.
3. Implement the smallest production change that satisfies the tests.
4. Run the relevant tests again and confirm they pass.
5. Run the applicable quality gates for the area touched.

## Quality Gates

Choose the commands that match the files, language, and framework being changed. Prefer existing project scripts and documented commands.

Required gates, when applicable:

- Formatting
- Tests
- Linting
- Static analysis or bug-finding tools

If a quality gate cannot be run because the command or dependency is unavailable, note the reason clearly.

## Engineering Standards

- Keep code minimal and focused on the requested behavior.
- Prefer clear, simple implementations over premature abstraction.
- Follow existing project conventions before introducing new patterns.
- Keep changes scoped to the task.
- Avoid unrelated refactors, dependency changes, or formatting churn.
- Add comments only when they explain non-obvious decisions.
- Preserve user work and do not overwrite unrelated local changes.
- Do not create commits unless the user explicitly asks for a commit.

## References

- The [thenvoi/codeband](https://github.com/thenvoi/codeband) repository may be used as a reference when relevant.

## Project Context

- Relevant project context is stored in the `docs/` directory.
- Update the relevant `docs/` files when a code or behavior change makes the existing project context outdated.

## Completion Criteria

A task is complete when:

- The intended behavior is covered by tests where practical.
- The implementation passes those tests.
- Applicable formatting, linting, and bug-finding checks have been run.
- Relevant project context in `docs/` has been updated when needed.
- Any skipped checks or residual risks are reported.
