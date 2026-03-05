# ckan-mcp-server — Docker

Questi file permettono di eseguire [ckan-mcp-server](https://github.com/piersoft/ckan-mcp-server) come immagine Docker.

## Struttura file

Copia questi tre file nella root della repo:

```
ckan-mcp-server/
├── Dockerfile          ← build multi-stage (builder + runtime)
├── docker-compose.yml  ← orchestrazione con variabili e healthcheck
├── .dockerignore       ← esclude node_modules, dist, docs, ecc.
└── ... (resto della repo)
```

## Avvio rapido

```bash
# 1. Clona la repo (se non l'hai già)
git clone https://github.com/piersoft/ckan-mcp-server.git
cd ckan-mcp-server

# 2. Copia i file Docker nella root della repo
#    (Dockerfile, docker-compose.yml, .dockerignore)

# 3. Build e avvio
docker compose up --build -d

# 4. Verifica che il server sia attivo
curl -s -X POST http://localhost:3000/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}' | jq .
```

Il server MCP sarà disponibile su `http://localhost:3000/mcp`.

## Build manuale (senza Compose)

```bash
# Build dell'immagine
docker build -t ckan-mcp-server:latest .

# Avvio del container
docker run -d \
  --name ckan-mcp-server \
  -p 3000:3000 \
  -e TRANSPORT=http \
  -e PORT=3000 \
  --restart unless-stopped \
  ckan-mcp-server:latest
```

## Variabili d'ambiente

| Variabile | Default | Descrizione |
|---|---|---|
| `TRANSPORT` | `http` | Modalità: `http` (server HTTP) o `stdio` (pipe locale) |
| `PORT` | `3000` | Porta su cui ascolta il server |
| `NODE_ENV` | `production` | Ambiente Node.js |

## Configurare Claude Desktop con il container

Una volta avviato il container, in `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ckan": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

## Logs e monitoring

```bash
# Segui i log in tempo reale
docker compose logs -f

# Stato healthcheck
docker inspect ckan-mcp-server | jq '.[0].State.Health'
```

## Note tecniche

- **Build multi-stage**: lo stage `builder` compila il TypeScript, lo stage `runtime` include solo il JS compilato e le `node_modules` di produzione → immagine finale ~120–150 MB.
- **Utente non-root**: il container gira come utente `node` (UID 1000) per sicurezza.
- **Healthcheck**: verifica ogni 30s che il server risponda alle richieste MCP JSON-RPC.
