# Privacy Policy

**Last updated: 2026-11-04**

## Overview

CKAN MCP Server is a read-only tool that connects AI assistants to public CKAN open data portals. It handles no accounts, credentials or cookies, and it never receives your conversation: only the arguments of the tool calls your AI client decides to make.

What is recorded depends on how you use it.

## Local installation (npm, Claude Desktop extension, stdio or your own HTTP server)

Nothing is collected or sent to us. The server writes a one-line audit log of each CKAN request to its own standard error, on your machine, and nowhere else. No analytics or telemetry leave your computer.

## Public demo instance (Cloudflare Workers)

The hosted endpoint `https://ckan-mcp-server.andy-pr.workers.dev/mcp` logs each tool call to understand how the service is used and to find bugs. For each call it records:

- the tool name, the target portal and the time of the call
- the search and query arguments (for example the search text, filters, paging, the dataset or resource id, SPARQL or SQL text truncated)
- for searches, the number of results and the ids/names of the datasets returned
- the outcome, a short error message, the duration and whether the cache answered

The server's logging code does not record your IP address, request headers, any identifier of you or your client, or your conversation.

These records are kept by Cloudflare Workers Observability for 7 days. An archive containing only the fields listed above is published in this repository as open data ([`data/worker_events_flat.jsonl`](https://github.com/ondata/ckan-mcp-server/blob/main/data/README.md), CC BY-SA 4.0). Since the search text is published, **do not put personal information in queries sent to the demo instance**. Cloudflare, as the hosting provider, processes connection data under its own [privacy policy](https://www.cloudflare.com/privacypolicy/).

If you prefer that nothing is logged, use a local installation.

## Third-Party Services

Queries are sent to the CKAN portal you choose (e.g., `https://www.dati.gov.it/opendata`, `https://open.canada.ca/data`). Those portals have their own privacy policies and terms of use.

## Open Source

This server is fully open source. You can review the complete source code, including what the demo instance logs (`src/worker.ts`), at:
https://github.com/ondata/ckan-mcp-server

## Contact

For questions about this privacy policy, open an issue at:
https://github.com/ondata/ckan-mcp-server/issues
