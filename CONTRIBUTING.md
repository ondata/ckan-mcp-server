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

## Adding a Portal

Known portals are listed in `src/portals.json`. Each entry requires:

- `id` — unique kebab-case identifier
- `name` — human-readable portal name
- `api_url` — canonical CKAN API base URL (no trailing slash)
- `api_url_aliases` — alternative URLs that resolve to the same portal (optional)

Optional fields:

| Field | Description |
|-------|-------------|
| `api_path` | Custom API path if not `/api/3/action` |
| `search.force_text_field` | Set `true` if the portal requires `text` instead of `q` for search |
| `hvd.category_field` | CKAN field name for HVD category |
| `sparql.endpoint_url` | SPARQL endpoint URL |
| `sparql.method` | HTTP method for SPARQL queries (`GET` or `POST`) |
| `dataset_view_url` | URL template for dataset pages (`{id}`, `{name}` placeholders) |
| `organization_view_url` | URL template for organization pages (`{name}` placeholder) |

Do not remove existing portals from `src/portals.json` in your PR — they are used by the community.

## Proposing a New Feature

For significant changes (new tools, architecture changes, breaking changes), open an issue first or follow the [OpenSpec](openspec/AGENTS.md) process to write a structured proposal before coding.
