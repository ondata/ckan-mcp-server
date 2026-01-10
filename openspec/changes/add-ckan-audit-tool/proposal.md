# Change: Add ckan_audit tool

## Why
Operators need an automated probe to detect datastore/SQL/alias support and capture portal quirks.

## What Changes
- Add MCP tool `ckan_audit` to probe CKAN API capabilities.
- Detect DataStore availability, SQL endpoint, and datastore id alias support.
- Return suggested overrides for portal configuration.

## Impact
- Affected specs: `ckan-insights`
- Affected code: `src/tools/status.ts` or new insights module

## Open Questions
- Should audit run only read-only GET probes?
- Which overrides format to return (JSON block vs markdown list)?
