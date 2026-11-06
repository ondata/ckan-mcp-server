# upstream-rate-limiter Specification

## ADDED Requirements

### Requirement: Per-hostname token bucket limits outgoing requests

The server SHALL throttle outgoing HTTP requests to each CKAN portal hostname using a
token bucket algorithm, with one independent bucket per hostname.

#### Scenario: requests within burst fire immediately

- **GIVEN** a hostname bucket that has `burst` tokens available
- **WHEN** `burst` requests are issued in rapid succession
- **THEN** all requests proceed without delay and tokens are consumed

#### Scenario: request beyond capacity waits for refill

- **GIVEN** a hostname bucket whose tokens are exhausted
- **WHEN** a new request is issued
- **THEN** the request waits until enough tokens have refilled, then proceeds

#### Scenario: different hostnames use independent buckets

- **GIVEN** requests to `dati.gov.it` and `data.gov.uk` issued in rapid succession
- **WHEN** one hostname's bucket is exhausted
- **THEN** requests to the other hostname are not affected

### Requirement: Requests that would wait beyond the configured limit SHALL fail fast

The server SHALL throw a `RateLimitError` when the computed wait time for a request
exceeds `CKAN_RATE_LIMIT_MAX_WAIT_MS`.

#### Scenario: timeout exceeded

- **GIVEN** a hostname bucket that is empty and the required wait exceeds `maxWaitMs`
- **WHEN** a new request is issued
- **THEN** a `RateLimitError` is thrown immediately without waiting

#### Scenario: error message identifies the hostname

- **GIVEN** a `RateLimitError` is thrown for `data.europa.eu`
- **THEN** the error message includes `data.europa.eu` and the computed wait time in ms

### Requirement: Cache hits SHALL NOT consume rate limit tokens

The server SHALL check the cache before acquiring a rate limit token. A response served
from cache does not count against the upstream rate limit.

#### Scenario: cache hit bypasses rate limiter

- **GIVEN** a cached response exists for a request and the rate limiter is active
- **WHEN** the request is processed
- **THEN** no token is consumed from the hostname bucket

### Requirement: Rate limiter is configurable and disableable

Operators SHALL be able to disable the rate limiter or tune its parameters via
environment variables.

#### Scenario: disabled globally

- **GIVEN** `CKAN_RATE_LIMIT_ENABLED=false`
- **WHEN** any number of requests to the same hostname are issued
- **THEN** no throttling occurs

#### Scenario: per-call bypass

- **GIVEN** a caller invokes `makeCkanRequest` with `{ rateLimit: false }`
- **WHEN** the request executes
- **THEN** no token is consumed regardless of `CKAN_RATE_LIMIT_ENABLED`

#### Scenario: custom RPS configured

- **GIVEN** `CKAN_RATE_LIMIT_RPS=2` and `CKAN_RATE_LIMIT_BURST=2`
- **WHEN** 3 requests to the same hostname arrive simultaneously
- **THEN** the third request is delayed by approximately 500 ms (1/2 rps)
