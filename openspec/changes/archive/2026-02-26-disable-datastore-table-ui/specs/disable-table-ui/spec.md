# Spec: Disable DataStore Table UI

## MODIFIED Requirements

### Requirement: Tool registration reverts to standard MCP SDK

`ckan_datastore_search` and `ckan_package_search` MUST use `server.tool()` instead of `registerAppTool()`. Tools MUST NOT include `_meta.ui` metadata or `structuredContent` in responses.

#### Scenario: DataStore search returns text only

Given a valid `ckan_datastore_search` call
When the tool executes successfully
Then the response contains only `text` content (markdown or JSON)
And no `structuredContent` field is present
And no `_meta` field references a UI resource

#### Scenario: Package search returns text only

Given a valid `ckan_package_search` call
When the tool executes successfully
Then the response contains only `text` content
And no `_meta` field references a UI resource

### Requirement: UI resource is not registered

The server MUST NOT register or serve the `ui://ckan/datastore-table` resource.

#### Scenario: Resource list excludes table UI

Given a running MCP server
When a client requests available resources
Then `ui://ckan/datastore-table` is not in the list

## REMOVED Requirements

- ### Requirement: MCP Apps integration disabled temporarily
  - The `registerAppTool` and `registerAppResource` integrations are disabled at runtime
  - The `@modelcontextprotocol/ext-apps` package remains in `package.json` but is not imported
  - #### Scenario: No ext-apps imports at runtime
    - Given the built server
    - When it starts
    - Then no module from `@modelcontextprotocol/ext-apps` is loaded
