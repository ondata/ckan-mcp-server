# Contributing

## Language

All code, comments, documentation, and commit messages must be in **English**.

## Commit Messages

Use the format: `<type>: <short description>`

Allowed types:

| Type | When to use |
|------|-------------|
| `feat` | New feature or tool |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `chore` | Maintenance (deps, config, build) |
| `refactor` | Code restructure, no behavior change |
| `test` | Adding or updating tests |

Examples:

```
feat: add ckan_group_search tool
fix: handle timeout errors in datastore queries
docs: update Docker setup instructions
```

Keep the subject line under 72 characters. No period at the end.

## Project Structure

```
ckan-mcp-server/
├── src/              # Source code (TypeScript)
├── tests/            # Test suite
├── docs/             # Documentation
├── docker/           # Core Docker files (Dockerfile, compose, bridge)
├── examples/         # Community integrations (one subfolder per integration)
│   └── <name>/
│       └── README.md
├── openspec/         # Spec-driven change proposals
└── scripts/          # Utility scripts
```

Place files in the right folder. Do not add new files to the repo root unless they are standard top-level files (README, LICENSE, Dockerfile, etc.).

## Pull Requests

Before opening a PR:

- [ ] Branch from `main` and keep it up to date with upstream
- [ ] No unrelated diffs (check `git diff main` carefully)
- [ ] Do not modify `src/portals.json` unless the PR is specifically about portals — local fork customizations should stay in your fork
- [ ] All tests pass: `npm test`
- [ ] Build succeeds: `npm run build`

## AI-Assisted Contributions

They are welcome, under conditions. The rule here is not "human or machine" but "reviewable or not": a maintainer must be able to check the whole change in a few minutes.

- **Disclose it.** Say so in the PR body, or run an account whose profile makes it plain. Undisclosed automated contributions will be closed without review.
- **Keep it small and single-purpose.** One issue, one concern, a diff a reviewer can read end to end. Large generated refactors will be closed regardless of quality.
- **Claim only what a reviewer can verify.** Do not list test runs or manual checks that cannot be reproduced from the diff — a passing suite on a docs-only change proves nothing and costs trust. If a claim matters, make it reproducible: exact command, exact portal, exact output.
- **Check that the work is wanted first.** Prefer an existing open issue. Unsolicited drive-by PRs are the most likely to be closed.
- **Read the code, don't paraphrase the issue.** If the issue and the code disagree, say so in the PR — that is the most useful thing a contributor can do.

Same bar as any other PR otherwise: tests pass, build succeeds, no unrelated diffs.

## Adding an Example Integration

Community integrations go under `examples/<name>/`. Each integration must have a `README.md` explaining what it does and how to run it. The core server files (`src/`, `docker/`) must not be modified as part of an example contribution.

## Adding a Portal

Known portals are listed in `src/portals.json`. Full documentation on fields, examples, and known portal configurations is in [`src/README.md`](src/README.md).

Do not remove existing portals from `src/portals.json` in your PR — they are used by the community.

## Proposing a New Feature

For significant changes (new tools, architecture changes, breaking changes), open an issue first or follow the [OpenSpec](openspec/AGENTS.md) process to write a structured proposal before coding.
