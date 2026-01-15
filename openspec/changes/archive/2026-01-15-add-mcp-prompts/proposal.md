# Change: Add MCP Guided Prompts

## Why
Users often need guidance to use CKAN tools correctly; guided prompts reduce misuse and speed up discovery workflows.

## What Changes
- Add a new MCP prompts capability with reusable guided prompts for common tasks.
- Register prompts in the MCP server so clients can discover and invoke them.
- Document prompts and examples in README/docs.

## Impact
- Affected specs: mcp-prompts (new)
- Affected code: `src/server.ts`, new `src/prompts/*`, docs/README
