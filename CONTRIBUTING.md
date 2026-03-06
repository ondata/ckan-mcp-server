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

## Adding an Example Integration

Community integrations go under `examples/<name>/`. Each integration must have a `README.md` explaining what it does and how to run it. The core server files (`src/`, `docker/`) must not be modified as part of an example contribution.
