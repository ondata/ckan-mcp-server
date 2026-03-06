# ckan-mcp-server — Docker

These files allow you to run [ckan-mcp-server](https://github.com/ondata/ckan-mcp-server) as a Docker image.

## File Structure

The following files are included in the repo:

```
ckan-mcp-server/
├── Dockerfile               ← multi-stage build (builder + runtime)
├── docker-compose.yml       ← orchestration with variables and healthcheck
├── docker/
│   └── README.md            ← this file
└── ... (rest of the repo)
```

## Quick Start

```bash
# 1. Clone the repo (if you haven't already)
git clone https://github.com/ondata/ckan-mcp-server.git
cd ckan-mcp-server

# 2. Build and start
docker compose up --build -d
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

Use the stdio bridge from [`examples/ollama-chat/`](../examples/ollama-chat/README.md) to connect Claude Desktop to the running container.

## Logs and Monitoring

```bash
# Follow logs in real time
docker compose logs -f
```

## Technical Notes

- **Multi-stage build**: the `builder` stage compiles TypeScript, the `runtime` stage includes only the compiled JS and production `node_modules` → final image ~120–150 MB.
- **Non-root user**: the container runs as the `node` user (UID 1000) for security.
- **Healthcheck**: verifies every 30s that the server responds to MCP JSON-RPC requests.
