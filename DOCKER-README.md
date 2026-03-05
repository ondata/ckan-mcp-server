# ckan-mcp-server — Docker

These files allow you to run [ckan-mcp-server](https://github.com/ondata/ckan-mcp-server) as a Docker image.

## File Structure

Copy these three files into the root of the repo:

```
ckan-mcp-server/
├── Dockerfile          ← multi-stage build (builder + runtime)
├── docker-compose.yml  ← orchestration with variables and healthcheck
├── .dockerignore       ← excludes node_modules, dist, docs, etc.
└── ... (rest of the repo)
```

## Quick Start

```bash
# 1. Clone the repo (if you haven't already)
git clone https://github.com/piersoft/ckan-mcp-server.git
cd ckan-mcp-server

# 2. Copy the Docker files into the repo root
#    (Dockerfile, docker-compose.yml, .dockerignore)

# 3. Build and start
docker compose up --build -d

# 4. Verify the server is running
curl -s -X POST http://localhost:3000/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}' | jq .
```

The MCP server will be available at `http://localhost:3000/mcp`.

## Manual Build (without Compose)

```bash
# Build the image
docker build -t ckan-mcp-server:latest .

# Start the container
docker run -d \
  --name ckan-mcp-server \
  -p 3000:3000 \
  -e TRANSPORT=http \
  -e PORT=3000 \
  --restart unless-stopped \
  ckan-mcp-server:latest
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `TRANSPORT` | `http` | Mode: `http` (HTTP server) or `stdio` (local pipe) |
| `PORT` | `3000` | Port the server listens on |
| `NODE_ENV` | `production` | Node.js environment |

## Configuring Claude Desktop with the Container

Once the container is running, add the following to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ckan": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

## Logs and Monitoring

```bash
# Follow logs in real time
docker compose logs -f
```

## Technical Notes

- **Multi-stage build**: the `builder` stage compiles TypeScript, the `runtime` stage includes only the compiled JS and production `node_modules` → final image ~120–150 MB.
- **Non-root user**: the container runs as the `node` user (UID 1000) for security.
- **Healthcheck**: verifies every 30s that the server responds to MCP JSON-RPC requests.
