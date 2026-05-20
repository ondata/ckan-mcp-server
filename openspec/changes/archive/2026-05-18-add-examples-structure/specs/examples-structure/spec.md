## ADDED Requirements

### Requirement: Examples Folder Convention
The project SHALL maintain an `examples/` folder for community integrations, where each integration lives in its own subdirectory with a README.

#### Scenario: New integration placement
- **WHEN** a contributor adds an integration (e.g. Ollama, LangGraph)
- **THEN** it goes under `examples/<integration-name>/` with at minimum a `README.md`

#### Scenario: Core Docker files unaffected
- **WHEN** a contributor looks at `docker/`
- **THEN** they find only files needed to run the MCP server itself (Dockerfile, docker-compose.yml, docker/README.md)

### Requirement: Ollama Chat Example
The project SHALL include `examples/ollama-chat/` with the stdio bridge and documentation for running the server via Ollama.

#### Scenario: Bridge file location
- **WHEN** a user needs the stdio bridge for Ollama
- **THEN** they find it at `examples/ollama-chat/ckan-mcp-bridge.js`

#### Scenario: README present
- **WHEN** a user opens `examples/ollama-chat/`
- **THEN** they find a README explaining how to use the bridge with Ollama
