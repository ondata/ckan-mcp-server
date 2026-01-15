# Change: add filtered CKAN dataset resource templates

## Why
Users need quick, direct access to filtered dataset lists (by theme, publisher, tag, format) without building complex tool queries.

## What Changes
- Add new MCP resource templates under the existing `ckan://{server}/...` scheme for group, organization, tag, and format dataset filters.
- Extend resource discovery to list the new templates.
- Document new resource URIs and examples.

## Impact
- Affected specs: mcp-resources
- Affected code: `src/resources/*`, `src/resources/uri.ts`, README/docs
