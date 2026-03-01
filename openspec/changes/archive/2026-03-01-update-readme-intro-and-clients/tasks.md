# Tasks: update-readme-intro-and-clients

## Phase 1 — Backup

- [x] Copy `README.md` → `README.bak.md` (preserve original)

## Phase 2 — Top of file: badges

- [x] Keep existing badges (npm, GitHub, deepwiki)
- [x] Add MIT license badge as last badge:
  `[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)`

## Phase 3 — New intro (replace current opening)

- [x] Write new intro section (≤ 5 short paragraphs) covering:
  - What it is in plain words (MCP server for CKAN open data portals)
  - Why it's useful: AI can read, search, and explain open data without user needing CKAN knowledge
  - Who it's for: everyone — journalists, researchers, public servants, developers
  - Two paths: `npm install -g @aborruso/ckan-mcp-server` (local, full control) OR use hosted HTTP endpoint (zero install)
  - Link to DeepWiki for deeper dive

## Phase 4 — New "Use it in your favorite tool" section

- [x] Create section after intro (before existing "Installation")
- [x] Per-client subsections (in this order):
  1. **ChatGPT** — web UI, paid plans, Settings → Connectors, HTTP endpoint URL
  2. **Claude Code** — `claude mcp add` CLI command (local npx + HTTP variants)
  3. **Claude Desktop** — JSON config block (local npx + HTTP variants), config file path per OS
  4. **Gemini CLI** — `~/.gemini/settings.json` with `mcpServers` block
  5. **VS Code** — `.vscode/settings.json` or User Settings JSON block
- [x] Each client shows: local install config AND hosted HTTP endpoint config (where supported)
- [x] Keep existing "MCP Client Configuration" section as-is (it covers more clients) but add cross-reference

## Phase 5 — Review

- [x] Verify README renders correctly (check markdown syntax)
- [x] Confirm no existing sections were removed or altered
- [x] Confirm backup file exists
