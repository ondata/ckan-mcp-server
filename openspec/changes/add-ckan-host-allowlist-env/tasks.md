## 1. Implementation
- [ ] Add allowlist parsing utility for `ALLOWED_CKAN_HOSTS` (comma-separated hostnames, case-insensitive, trim whitespace).
- [ ] Enforce allowlist for all CKAN requests (tools and resource templates) with clear error messaging.
- [ ] Ensure allowlist applies to both Node and Workers runtimes.

## 2. Configuration
- [ ] Add `ALLOWED_CKAN_HOSTS` to `wrangler.toml` with example values.
- [ ] Update docs/README to describe the env var and behavior (optional if required by spec).

## 3. Tests
- [ ] Add unit tests for allowlist parsing and validation.
- [ ] Add tool/resource tests verifying rejection for non-allowed hosts when env var is set.
