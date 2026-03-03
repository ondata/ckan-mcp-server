## ADDED Requirements

### Requirement: DXT Manifest
The repository SHALL include a `manifest.json` at the root conforming to the DXT specification v0.1, declaring `name`, `version`, `description`, `author`, and `server` (type `node`, entry point `server/index.js`).

#### Scenario: Valid manifest
- **WHEN** `dxt validate` is run against `manifest.json`
- **THEN** it reports no errors

#### Scenario: No user_config required
- **WHEN** a user installs the `.dxt` in Claude Desktop
- **THEN** no configuration prompts are shown at install time (server_url is per-call)

### Requirement: DXT Pack Script
The project SHALL expose an `npm run pack:dxt` script that produces a valid `.dxt` archive from the current build output.

#### Scenario: Successful pack
- **WHEN** `npm run pack:dxt` is executed after a successful `npm run build`
- **THEN** a `.dxt` file is created in the project root with `manifest.json` and `server/index.js` inside

#### Scenario: Output excluded from version control
- **WHEN** a `.dxt` file is produced
- **THEN** it is listed in `.gitignore` and not committed to the repository

### Requirement: Release Artifact
Each GitHub release SHALL include the `.dxt` file as a downloadable binary attachment.

#### Scenario: Release download
- **WHEN** a user visits a GitHub release page
- **THEN** a `.dxt` file is available for direct download

### Requirement: One-Click Install Documentation
The `README.md` SHALL document one-click install via `.dxt` as the primary installation method for Claude Desktop, placed before the manual JSON config instructions.

#### Scenario: README section present
- **WHEN** a user reads the README
- **THEN** they find a dedicated section explaining how to download and double-click the `.dxt` file to install
