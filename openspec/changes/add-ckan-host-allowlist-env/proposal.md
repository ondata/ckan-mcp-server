# Change: Add allowlist for CKAN hosts via environment

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
