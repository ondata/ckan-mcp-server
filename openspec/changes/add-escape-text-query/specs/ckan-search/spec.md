## MODIFIED Requirements
### Requirement: Package search parser override
The system SHALL support a per-portal default and a per-request override to force package search queries through the `text` field when needed, and SHALL escape Solr/Lucene special characters when wrapping queries in `text:(...)`.

#### Scenario: Portal default applies
- **WHEN** a portal is configured to force the text-field parser
- **THEN** `ckan_package_search` uses `text:(...)` for non-fielded queries by default with escaped query content

#### Scenario: Request override applies
- **WHEN** a client explicitly requests the text-field parser
- **THEN** `ckan_package_search` uses `text:(...)` regardless of portal defaults with escaped query content
