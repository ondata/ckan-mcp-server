# Design: CKAN Host Allowlist via Environment

## Overview
Introduce an optional, environment-driven allowlist for CKAN hosts. When configured, all CKAN requests must target hosts in the allowlist. When not configured, behavior remains unchanged.

## Configuration
- Environment variable: `ALLOWED_CKAN_HOSTS`
- Format: comma-separated hostnames (e.g., `dati.gov.it,data.gov,catalog.data.gov`)
- Parsing rules:
  - Split on commas
  - Trim whitespace
  - Lowercase
  - Drop empty entries

## Enforcement
- Validate hostnames extracted from:
  - Tool inputs: `server_url`
  - Resource URIs: `ckan://{server}/...`
- Reject requests where the hostname is not in the allowlist.
- Error message should be explicit: `Host not allowed: <hostname>`.

## Runtime Scope
- Node.js (stdio/http) and Workers runtimes share the same validation utility.
- Workers reads env via `env.ALLOWED_CKAN_HOSTS` (wrangler var), Node via `process.env.ALLOWED_CKAN_HOSTS`.

## Integration Points
- Add a small utility module, e.g. `src/utils/allowlist.ts`:
  - `parseAllowedHosts(value?: string): Set<string> | null`
  - `assertAllowedHost(serverUrl: string, allowed: Set<string> | null): void`
- Call `assertAllowedHost` inside CKAN request flow or immediately in each tool/resource handler before network calls.

## Backwards Compatibility
- If `ALLOWED_CKAN_HOSTS` is unset or empty, allow all hosts (no behavior change).

## Testing
- Unit tests for parsing behavior (case, whitespace, empty entries).
- Unit tests for allow/deny logic with known hostnames and invalid URLs.
- Tool/resource tests to verify rejection when allowlist is set.
