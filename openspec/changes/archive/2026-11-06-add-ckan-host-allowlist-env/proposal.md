# Change: Add allowlist for CKAN hosts via environment

> Superseded, not implemented as written. The same need was met by `CKAN_ALLOWED_DOMAINS` (v0.4.103, mandatory for the HTTP transport since v0.4.108). `ALLOWED_CKAN_HOSTS` never existed in the code, so this change was archived on 2026-11-06 without updating the specs.

## Why
Public HTTP/Workers deployments can be abused to proxy requests to arbitrary hosts. A host allowlist provides a simple, configurable barrier without breaking local usage.

## What Changes
- Add `ALLOWED_CKAN_HOSTS` env var (comma-separated hostnames) to restrict `server_url` targets.
- Validate `server_url` host against the allowlist for all tools/resources that call CKAN.
- Document and expose the env var in `wrangler.toml` for Workers deployments.

## Design Reference
See `openspec/changes/add-ckan-host-allowlist-env/design.md` for configuration, enforcement, and runtime details.

## Impact
- Affected specs: `cloudflare-deployment`, new `ckan-request-allowlist`
- Affected code: request validation utilities; Workers/Node configuration handling; tools/resources that accept `server_url` or `ckan://` URIs.
