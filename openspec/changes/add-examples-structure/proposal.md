# Change: Add examples/ structure

## Why

PR #14 introduced an Ollama+React integration but had no clear home. `docker/ckan-mcp-bridge.js` ended up in `docker/` even though it belongs to that integration, not to the core Docker setup. A formalized `examples/` pattern prevents this ambiguity for future contributors.

## What Changes

- Move `docker/ckan-mcp-bridge.js` → `examples/ollama-chat/ckan-mcp-bridge.js`
- Add `examples/ollama-chat/README.md` documenting the integration
- Update `docker/README.md` to remove reference to the bridge
- Update root `.gitignore`: replace specific `examples/langgraph/` with a policy comment
- Document the `examples/<name>/` pattern in `CONTRIBUTING.md` (companion to add-contributing-guide)

## Impact

- Affected specs: examples-structure (new)
- Affected code: `docker/README.md`, `docker/ckan-mcp-bridge.js` (moved), `.gitignore`
