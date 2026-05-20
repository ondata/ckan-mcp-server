## Context
The DXT format (Desktop Extension, spec v0.1) is an official Anthropic standard for packaging local MCP servers as single-file installers. Claude Desktop includes a built-in Node.js runtime, so no external dependencies are needed at install time.

## Goals / Non-Goals
- Goals:
  - Enable one-click install via `.dxt` double-click in Claude Desktop
  - Reuse the existing esbuild single-file bundle (`dist/index.js`)
  - Keep packaging as a separate optional step (not part of main build)
- Non-Goals:
  - Auto-update mechanism
  - Bundling Python runtime or other non-Node runtimes
  - Changing transport or tool behavior

## Decisions

### manifest.json structure
```json
{
  "dxt_version": "0.1",
  "name": "ckan-mcp-server",
  "version": "<from package.json>",
  "description": "CKAN open data portal explorer",
  "author": { "name": "ondata" },
  "server": {
    "type": "node",
    "entry_point": "server/index.js",
    "mcp_config": {
      "command": "node",
      "args": ["${__dirname}/server/index.js"]
    }
  }
}
```

**No `user_config` needed**: `server_url` is passed per-tool-call, not at install time.

### Bundle strategy
Since esbuild already produces a single `dist/index.js` with all internal modules inlined, the `.dxt` zip only needs:
```
manifest.json
server/index.js          ← copy of dist/index.js
node_modules/            ← only the 4 external runtime deps
icon.png                 ← optional
```

External runtime deps (must be included): `@modelcontextprotocol/sdk`, `axios`, `zod`, `express`.

### Toolchain
Use `@anthropic-ai/dxt` CLI (`dxt pack`) which reads `manifest.json` and zips the directory.

## Risks / Trade-offs
- `.dxt` file will be ~5-10 MB due to bundled node_modules — acceptable for a release artifact
- DXT spec is v0.1 and may evolve; monitor Anthropic releases

## Open Questions
- None blocking implementation
