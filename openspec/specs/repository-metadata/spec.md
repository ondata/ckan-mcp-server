# repository-metadata Specification

## Purpose
TBD - created by archiving change update-repo-owner-ondata. Update Purpose after archive.
## Requirements
### Requirement: Canonical repository ownership references
The project documentation and UI MUST reference the canonical repository under the ondata organization once the repository is migrated.

#### Scenario: Repository references updated
- **WHEN** a user follows documentation or UI links to the repository
- **THEN** the links point to the ondata organization repository URL

### Requirement: NPM package ownership remains personal
The project MUST continue to document the npm package under the @aborruso scope unless an explicit npm ownership change is approved.

#### Scenario: npm install instructions unchanged
- **WHEN** a user follows installation instructions
- **THEN** the package name remains @aborruso/ckan-mcp-server

