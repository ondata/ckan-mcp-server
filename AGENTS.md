<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:

- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:

- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# Agent Guide

## Scope

- Repo: `ckan-mcp-server`
- Stack: Node.js + TypeScript (ESM)
- Tests: Vitest
- Build: esbuild
- Cloudflare Workers: `wrangler`

## Cursor and Copilot Rules

- No `.cursor/rules`, `.cursorrules`, or `.github/copilot-instructions.md` found

## Commands

**Install**: `npm install`

**Build**: `npm run build` | `npm run build:tsc` | `npm run build:worker`

**Run**: `npm start` | `npm run dev` | `npm run watch` | `npm run dev:worker` | `npm run deploy`

**Test**: `npm test` | `npm run test:watch` | `npm run test:coverage`

**Single test**: `npm test -- tests/unit/http.test.ts` | `npm test -- -t "testName"`

## Local MCP Client Build Test

Before deploying, you can test the current dev build by pointing your MCP client at the Node entrypoint in `dist/`:

1. Build: `npm run build`
2. Example absolute path: `/home/aborruso/git/idee/ckan-mcp-server/dist/index.js` (adjust to your local checkout)

## GitHub CLI Notes

When creating issues with multi-line bodies, avoid literal `\n` in `--body`. Use a here-doc
or `-F -` to preserve newlines:

```bash
cat <<'EOF' | gh issue create --title "Title" --body-file - --repo ondata/ckan-mcp-server
Line 1
Line 2
EOF
```

## TypeScript Style

Use strict typing, avoid `any` unless from CKAN payloads. Prefer explicit return types, `type` aliases, ESM imports with `.js` extensions. Keep `noUnusedLocals` and `noUnusedParameters` clean.

## Import Conventions

Use `import type` for type-only imports. Group by kind: external, internal, types. Double quotes, relative paths.

## Naming

`camelCase` vars/functions, `PascalCase` types/classes, `UPPER_SNAKE_CASE` constants. Tool names match MCP tool ids.

## Error Handling

Wrap tool handlers in `try/catch`. Return `{ isError: true }` for MCP errors. Include context, map HTTP errors to readable messages, preserve cause when rethrowing.

## Tool Responses

Use `ResponseFormat` for markdown vs JSON. `truncateText` for large payloads. Pretty-print JSON, include `structuredContent` for JSON mode.

## Testing Guidelines

Vitest with `globals: true`. Place tests in `tests/unit` or `tests/integration`. AAA pattern, mock via fixtures in `tests/fixtures`, descriptive names.

## Test Targets

Never use `demo.ckan.org` for tests. Always use `https://www.dati.gov.it/opendata`.

## Configuration

Node `>=18`. Worker build in `wrangler.toml`. Vitest coverage thresholds enforced.

## Change Hygiene

Minimal focused diffs. No unrelated refactors. Update tests for behavior changes. Avoid editing `dist/`.

## Project Layout

`src/index.ts` entry, `src/server.ts` wiring, `src/tools/` handlers, `src/utils/` helpers, `src/resources/` templates, `src/transport/` stdio/HTTP. `tests/unit/` utilities, `tests/integration/` behavior, `tests/fixtures/` mocks.

## CSV Data Exploration

For exploring CSV resources from datasets, use duckdb CLI (already installed) with direct HTTP URL:

```bash
duckdb -jsonlines -c "DESCRIBE SELECT * FROM read_csv('http://url/file.csv')"
duckdb -jsonlines -c "SUMMARIZE SELECT * FROM read_csv('http://url/file.csv')"
duckdb -jsonlines -c "SELECT * FROM read_csv('http://url/file.csv') USING SAMPLE 10"
```

Use direct resource URLs (http/https), not GitHub view/blob URLs. The `-jsonlines` parameter outputs in JSONL format, easier for AI to parse.

For random sampling, use `USING SAMPLE N` syntax (where N is the number of rows):

```bash
duckdb -jsonlines -c "SELECT * FROM read_csv('http://url/file.csv') USING SAMPLE 10"
```
