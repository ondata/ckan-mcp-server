# Ollama Chat — stdio bridge for ckan-mcp-server

This example provides a stdio bridge that allows MCP clients configured for local process communication (e.g. Claude Desktop) to talk to a `ckan-mcp-server` instance running as an HTTP container.

```
MCP client (stdio) <---> ckan-mcp-bridge.js <---> ckan-mcp-server (HTTP)
```

## Prerequisites

- `ckan-mcp-server` running as a Docker container (see [`docker/README.md`](../../docker/README.md))
- Node.js installed on the host machine

## Usage

### Claude Desktop

Add this to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ckan": {
      "command": "node",
      "args": ["/path/to/ckan-mcp-server/examples/ollama-chat/ckan-mcp-bridge.js"],
      "env": {
        "MCP_URL": "http://localhost:3000/mcp"
      }
    }
  }
}
```

Set `MCP_URL` to point to your Docker host if the container runs on a remote machine.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_URL` | `http://localhost:3000/mcp` | URL of the running ckan-mcp-server |
