# Privacy Policy

**Last updated: 2026-03-07**

## Overview

CKAN MCP Server is a read-only, stateless tool that connects AI assistants to public CKAN open data portals. It does not collect, store, or transmit any personal data.

## Data Collection

This server collects **no personal data**. Specifically:

- No user information is collected or stored
- No conversation content is logged or retained
- No analytics or telemetry are sent
- No cookies or tracking mechanisms are used

## How It Works

When you use this server, it forwards your queries directly to the public API of the CKAN portal you specify (e.g., `dati.gov.it`, `data.gov`). The server acts as a transparent proxy — it does not store, analyze, or process query results beyond returning them to your AI client.

All data accessed through this server is **publicly available** on the respective CKAN portals. No authentication credentials are required or handled.

## Third-Party Services

Queries are sent to the CKAN portal you configure (e.g., `https://dati.gov.it`, `https://open.canada.ca/data`). Those portals have their own privacy policies and terms of use.

## Open Source

This server is fully open source. You can review the complete source code at:
https://github.com/ondata/ckan-mcp-server

## Contact

For questions about this privacy policy, open an issue at:
https://github.com/ondata/ckan-mcp-server/issues
