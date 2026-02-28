# Spec: ckan-catalog-stats

## ADDED Requirements

### Requirement: `ckan_catalog_stats` tool MUST return portal-level statistics

The MCP server MUST expose a `ckan_catalog_stats` tool that accepts only `server_url`
(and optional `facet_limit`) and returns total dataset count plus facet breakdowns
for categories (`groups`), formats (`res_format`), and organizations (`organization`).

#### Scenario: Basic portal overview
Given a CKAN server URL,
When `ckan_catalog_stats` is called,
Then the response includes total dataset count and ranked lists for groups, formats, and organizations.

#### Scenario: Results sorted by count descending
Given a portal with multiple categories,
When `ckan_catalog_stats` is called,
Then each facet list MUST be sorted with the highest-count entry first.

#### Scenario: facet_limit controls max entries per facet
Given `facet_limit=5`,
When `ckan_catalog_stats` is called,
Then each facet section shows at most 5 entries.

#### Scenario: Missing facet field gracefully omitted
Given a CKAN portal that does not return a `groups` facet,
When `ckan_catalog_stats` is called,
Then the response MUST omit that section without error.
