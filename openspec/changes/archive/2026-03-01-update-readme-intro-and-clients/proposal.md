# Proposal: update-readme-intro-and-clients

## Summary

Rewrite the main README to be more accessible and welcoming to all user types.
The current README is too technical and tool-oriented from the first line — it doesn't explain *why* someone should care or how easy it is to get started.

Key goals:

1. **Accessible intro**: explain in plain words what this is, why it's useful, and who it's for — regardless of technical background.
2. **Two paths clearly presented**: install locally in seconds *or* use the hosted HTTP endpoint with zero installation.
3. **Inclusive message**: this tool is for everyone — not just developers. It lowers barriers between users and CKAN open data portals.
4. **Updated badges**: keep existing badges, add MIT license badge as last.
5. **New "Use it in your favorite tool" section**: concise, per-client setup instructions for the 5 priority clients, inspired by datagouv-mcp structure but original writing.
6. **Backup current README** before any changes.

## Scope

Documentation only — no code changes.

## Priority Clients

- ChatGPT (web, paid plans)
- Claude Code (CLI)
- Claude Desktop (local app)
- Gemini CLI
- VS Code (with GitHub Copilot / MCP support)

## Out of Scope

- All other existing README sections (tools list, Solr queries, portal list, etc.) — preserved as-is.
- No changes to code, tests, or configuration files.

## Reference

Inspired by (not copied from): https://github.com/datagouv/datagouv-mcp/blob/main/README.md
Their per-client setup table structure is a good model for clarity.

## Open Questions

- None blocking. User will provide additional instructions after initial implementation.
