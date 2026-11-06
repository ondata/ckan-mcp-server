# http-caching Specification

## Purpose
Read-through cache for CKAN API responses in `makeCkanRequest`, with an action-based TTL and a backend suited to the runtime.
## Requirements
### Requirement: Read-through cache for CKAN API requests

The server SHALL cache successful CKAN API responses at the `makeCkanRequest` layer and return cached values for identical subsequent requests within their TTL.

#### Scenario: identical requests hit cache

- **GIVEN** a CKAN request for `action=package_search` with a given set of params has succeeded and been cached
- **WHEN** a second identical request is issued within the TTL window
- **THEN** the server returns the cached payload without contacting the upstream portal

#### Scenario: different params produce different cache entries

- **GIVEN** two requests to the same action with different `q` values
- **WHEN** both are executed
- **THEN** each produces its own cache entry and neither is served from the other's data

#### Scenario: parameter order does not affect cache identity

- **GIVEN** two requests with the same params in a different key order
- **WHEN** both are executed
- **THEN** the second is served from the cache populated by the first

### Requirement: Failures and invalid responses SHALL NOT be cached

The server SHALL NOT store responses that represent errors, validation failures, or payloads exceeding the configured size ceiling.

#### Scenario: upstream error is not cached

- **GIVEN** a CKAN call that returns HTTP 500 or network timeout
- **WHEN** the error is raised to the tool
- **THEN** no entry is written to the cache and the next identical call re-contacts the upstream

#### Scenario: success=false response is not cached

- **GIVEN** a CKAN response with HTTP 200 but body `success: false`
- **WHEN** the error is raised to the tool
- **THEN** no entry is written to the cache

#### Scenario: oversize response is not cached

- **GIVEN** a CKAN response whose serialized payload exceeds `CKAN_CACHE_MAX_ENTRY_BYTES`
- **WHEN** the payload is returned to the caller
- **THEN** no entry is written to the cache

### Requirement: TTL policy driven by action

The server SHALL select a TTL based on the CKAN `action` being invoked, with a safe default for unknown actions.

#### Scenario: search and metadata actions use default catalog TTL

- **GIVEN** an action in { `package_search`, `package_show`, `organization_show`, `organization_list`, `organization_search`, `group_show`, `group_list`, `tag_list` }
- **WHEN** the response is cached
- **THEN** the TTL is 300 seconds unless overridden by configuration

#### Scenario: datastore actions use a short TTL

- **GIVEN** an action in { `datastore_search`, `datastore_search_sql` }
- **WHEN** the response is cached
- **THEN** the TTL is 60 seconds

#### Scenario: status actions use a long TTL

- **GIVEN** an action in { `status_show`, `site_read` }
- **WHEN** the response is cached
- **THEN** the TTL is 3600 seconds

#### Scenario: unknown actions fall back to configured default

- **GIVEN** an action not listed in the TTL policy table
- **WHEN** the response is cached
- **THEN** the TTL equals `CKAN_CACHE_TTL_DEFAULT` (300 seconds if unset)

### Requirement: Configurable and disableable

Operators SHALL be able to disable the cache entirely or tune its parameters via environment variables, without code changes.

#### Scenario: cache disabled globally

- **GIVEN** `CKAN_CACHE_ENABLED=false`
- **WHEN** any CKAN request is issued
- **THEN** no cache lookup or write occurs and every request reaches the upstream

#### Scenario: per-call bypass

- **GIVEN** a caller invokes `makeCkanRequest` with `{ cache: false }`
- **WHEN** the request executes
- **THEN** the cache is neither read nor written for that call, regardless of `CKAN_CACHE_ENABLED`

#### Scenario: entry count cap in Node runtime

- **GIVEN** the Node in-memory backend is active and `CKAN_CACHE_MAX_ENTRIES=N`
- **WHEN** more than N distinct entries are written
- **THEN** the least recently used entries are evicted to keep the total at most N

### Requirement: Runtime-appropriate backend selection

The server SHALL use a cache backend that matches the runtime, without requiring tool code to know which runtime is active.

#### Scenario: Cloudflare Workers runtime uses the Cache API

- **GIVEN** the code runs in a Workers isolate where `globalThis.caches` is available
- **WHEN** a CKAN response is cached
- **THEN** it is stored via `caches.default` with `Cache-Control: s-maxage=<ttl>`

#### Scenario: Node.js runtime uses bounded in-memory LRU

- **GIVEN** the code runs in a Node process
- **WHEN** a CKAN response is cached
- **THEN** it is stored in an in-memory LRU map with an explicit expiry timestamp

