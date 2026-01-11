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

## Core Commands

Install deps:

```bash
npm install
```

Build (node bundle):

```bash
npm run build
```

Build (worker bundle):

```bash
npm run build:worker
```

TypeScript build (tsc):

```bash
npm run build:tsc
```

Start server (stdio or HTTP via env):

```bash
npm start
```

Dev build + run:

```bash
npm run dev
```

Watch build:

```bash
npm run watch
```

Cloudflare dev:

```bash
npm run dev:worker
```

Deploy worker:

```bash
npm run deploy
```

## Tests

Run all tests:

```bash
npm test
```

Watch tests:

```bash
npm run test:watch
```

Coverage:

```bash
npm run test:coverage
```

Run a single file:

```bash
npm test -- tests/unit/http.test.ts
```

Run a single test name:

```bash
npm test -- -t "makeCkanRequest"
```

Run single file with Vitest directly:

```bash
npx vitest tests/unit/http.test.ts
```

## Lint and Format

- No ESLint or Prettier config detected
- Do not add new formatters unless requested
- Keep formatting consistent with existing files

## Project Layout

- `src/index.ts` entry point
- `src/server.ts` server wiring
- `src/tools/` MCP tool handlers
- `src/utils/` helpers (http, formatting, search)
- `src/resources/` MCP resource templates
- `src/transport/` stdio + HTTP
- `tests/unit/` utilities
- `tests/integration/` tool behavior
- `tests/fixtures/` mocked CKAN API responses

## TypeScript Style

- Use strict typing (`tsconfig.json` has `strict: true`)
- Avoid `any` unless unavoidable or from CKAN payloads
- Prefer explicit return types for exported functions
- Use `type` aliases for structured objects
- Keep `noUnusedLocals` and `noUnusedParameters` clean
- ESM imports with `.js` extensions for local modules

## Import Conventions

- Use `import type` for type-only imports
- Group imports by kind: external, internal, types
- Use double quotes for strings
- Keep import paths relative and short

## Naming

- `camelCase` for vars/functions
- `PascalCase` for types/classes
- `UPPER_SNAKE_CASE` for constants
- Tool names match MCP tool id strings

## Error Handling

- Wrap tool handlers in `try/catch`
- Return `{ isError: true }` for MCP errors
- Include user-facing error text with context
- For HTTP errors, map to readable messages
- Preserve error cause when rethrowing

## Tool Responses

- Use `ResponseFormat` for markdown vs JSON
- Use `truncateText` for large payloads
- Keep JSON output pretty-printed
- Include `structuredContent` for JSON mode

## Testing Guidelines

- Tests use Vitest and `globals: true`
- Place new tests in `tests/unit` or `tests/integration`
- Follow AAA pattern: Arrange, Act, Assert
- Mock CKAN API via fixtures under `tests/fixtures`
- Name tests descriptively with expected behavior

## Configuration Notes

- Node engine: `>=18`
- Worker build command set in `wrangler.toml`
- Vitest coverage thresholds enforced in `vitest.config.ts`

## Change Hygiene

- Keep diffs minimal and focused
- Avoid unrelated refactors
- Update tests for behavior changes
- Avoid editing `dist/` (generated)
