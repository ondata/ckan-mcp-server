# mcp-prompts Specification

## Purpose
TBD - created by archiving change add-mcp-prompts. Update Purpose after archive.
## Requirements
### Requirement: Guided prompts are available
The system SHALL expose a set of guided MCP prompts for common CKAN discovery workflows.

#### Scenario: User requests a guided search prompt
- **WHEN** a client lists MCP prompts
- **THEN** the guided prompts are returned with name, description, and parameters

### Requirement: Prompt output includes tool usage instructions
Each guided prompt SHALL produce instructions that reference the appropriate CKAN tools and parameters.

#### Scenario: Prompt generation for thematic search
- **WHEN** the user generates a prompt for a specific theme and format
- **THEN** the output includes the correct tool name and required parameters

### Requirement: Prompt content is localized and consistent
Guided prompts SHALL use consistent language and parameter naming aligned with CKAN tool schemas.

#### Scenario: Prompt content consistency
- **WHEN** a prompt is generated
- **THEN** parameter names match the tool schema (e.g., `server_url`, `q`, `fq`, `rows`)

