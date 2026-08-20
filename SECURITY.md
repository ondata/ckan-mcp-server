# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it
responsibly through **GitHub Private Vulnerability Reporting (PVR)**.

**To report**: Go to the [Security Advisories page](../../security/advisories/new)
and submit a new advisory.

Please **do not** open public issues for security vulnerabilities.

## Supported Versions

Only the latest published version receives security fixes. Always run the most
recent release — see the disclosure table below for the minimum version that
carries each fix.

## Published Advisories

All advisories are published on the
[Security Advisories page](https://github.com/ondata/ckan-mcp-server/security/advisories),
with the fix released to npm before publication.

| Published | Advisory | CVE | Severity | Fixed in | Issue |
|---|---|---|---|---|---|
| 2026-08-20 | [GHSA-x32r-mh7g-q2rf](https://github.com/ondata/ckan-mcp-server/security/advisories/GHSA-x32r-mh7g-q2rf) | requested | Medium | 0.4.119 | SSRF guard missed IPv6 ranges embedding IPv4 (NAT64 / 6to4 / IPv4-compatible) |
| 2026-07-09 | [GHSA-vmrr-v4xp-42cx](https://github.com/ondata/ckan-mcp-server/security/advisories/GHSA-vmrr-v4xp-42cx) | CVE-2026-76812 | Critical | 0.4.110 | Unauthenticated remote SSRF to cloud metadata → IAM credential theft |
| 2026-07-09 | [GHSA-38f8-m897-jm7w](https://github.com/ondata/ckan-mcp-server/security/advisories/GHSA-38f8-m897-jm7w) | CVE-2026-76811 | High | 0.4.110 | SSRF in `sparql_query` / fetch-based paths via unvalidated redirects and DNS rebinding |
| 2026-07-09 | [GHSA-q5gv-wppg-53fv](https://github.com/ondata/ckan-mcp-server/security/advisories/GHSA-q5gv-wppg-53fv) | CVE-2026-76813 | High | 0.4.111 | Denial of service via unbounded response buffering and synchronous decompression |
| 2026-07-09 | [GHSA-83x6-42hr-jc76](https://github.com/ondata/ckan-mcp-server/security/advisories/GHSA-83x6-42hr-jc76) | CVE-2026-73845 | Medium | 0.4.111 | MQA server allowlist bypass via unanchored regex (`isValidMqaServer`) |
| 2026-07-09 | [GHSA-78x9-fhhx-v2g6](https://github.com/ondata/ckan-mcp-server/security/advisories/GHSA-78x9-fhhx-v2g6) | CVE-2026-73846 | Medium | 0.4.111 | Cache-key canonicalization collision enables cache confusion / poisoning |
| 2026-07-09 | [GHSA-3369-fmrv-vh4j](https://github.com/ondata/ckan-mcp-server/security/advisories/GHSA-3369-fmrv-vh4j) | CVE-2026-76896 | Medium | 0.4.109 | Second-order SSRF: destination derived from attacker-controlled dataset metadata |
| 2026-07-09 | [GHSA-c499-9f77-93m8](https://github.com/ondata/ckan-mcp-server/security/advisories/GHSA-c499-9f77-93m8) | CVE-2026-76895 | Medium | 0.4.109 | Portal-controlled fields emitted verbatim in tool output (injection) |
| 2026-07-09 | [GHSA-v3j5-c4v8-4pjr](https://github.com/ondata/ckan-mcp-server/security/advisories/GHSA-v3j5-c4v8-4pjr) | CVE-2026-76897 | Medium | 0.4.109 | HTTP transport does not validate `Origin`/`Host` on `/mcp` (DNS rebinding) |
| 2026-07-09 | [GHSA-6f9w-9hf2-5rg3](https://github.com/ondata/ckan-mcp-server/security/advisories/GHSA-6f9w-9hf2-5rg3) | CVE-2026-73844 | Low | 0.4.112 | Information disclosure via verbose error reflection |
| 2026-07-09 | [GHSA-vqff-r82h-9crc](https://github.com/ondata/ckan-mcp-server/security/advisories/GHSA-vqff-r82h-9crc) | CVE-2026-76894 | Low | 0.4.112 | DataStore Table UI resource does not validate `postMessage` origin |
| 2026-06-22 | [GHSA-798p-78g2-v556](https://github.com/ondata/ckan-mcp-server/security/advisories/GHSA-798p-78g2-v556) | CVE-2026-61612 | Medium | 0.4.108 | SSRF via DNS name → internal IP — incomplete fix of CVE-2026-53509 |
| 2026-05-31 | [GHSA-g84h-j7jj-x32p](https://github.com/ondata/ckan-mcp-server/security/advisories/GHSA-g84h-j7jj-x32p) | CVE-2026-53509 | Medium | 0.4.106 | Fix bypass of CVE-2026-33060 |
| 2026-03-16 | [GHSA-3xm7-qw7j-qc8v](https://github.com/ondata/ckan-mcp-server/security/advisories/GHSA-3xm7-qw7j-qc8v) | CVE-2026-33060 | Medium | 0.4.85 | SSRF via `base_url` allows access to internal networks |

`GHSA-x32r-mh7g-q2rf` has a CVE requested; GitHub had not assigned an ID at the
time of writing. Every other published advisory now carries one.
