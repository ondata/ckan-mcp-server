## ADDED Requirements

### Requirement: Accessible introductory section in README

The README MUST open with a plain-language explanation of what the server is, why it's useful, and who it's for — before any technical detail.

#### Scenario: Non-developer reads the README
Given a journalist or public servant visiting the repository page
When they read the first screen of the README
Then they understand what the server does without needing prior MCP or CKAN knowledge
And they see two clear paths: install locally or use the hosted endpoint

### Requirement: "Use it in your favorite tool" section

The README MUST include a dedicated section with per-client setup instructions for the five priority clients: ChatGPT, Claude Code, Claude Desktop, Gemini CLI, and VS Code.

#### Scenario: User sets up Claude Code
Given a user who has Claude Code installed
When they read the "Use it in your favorite tool" section
Then they find a Claude Code subsection with a ready-to-run CLI command
And both local (npx) and hosted HTTP endpoint variants are shown

#### Scenario: User sets up ChatGPT connector
Given a ChatGPT user with a paid plan
When they read the ChatGPT subsection
Then they find step-by-step instructions using the Settings → Connectors UI
And the hosted HTTP endpoint URL is provided

### Requirement: MIT license badge present in README

The README MUST display an MIT license badge as the last badge in the badge row.

#### Scenario: Badge row visible in README
Given a visitor to the repository home page
When they look at the top of the README
Then they see the npm, GitHub, deepwiki, and MIT license badges in order
And the MIT badge links to https://opensource.org/licenses/MIT
