# CKAN Chat — LLM locale + open data

Chat in linguaggio naturale sui dati aperti CKAN, con LLM locale via Ollama.

```
[React Frontend :8080]
      ↓ HTTP
[Node.js Backend :3001]
      ↓ Ollama API          ↓ MCP JSON-RPC
[Ollama :11434]    [ckan-mcp-server :3000]
  (LLM locale)       (dati.gov.it, ecc.)
```

## Prerequisiti

- Docker + Docker Compose
- [Ollama](https://ollama.ai) installato sul host
- Un modello con tool calling scaricato:

```bash
ollama pull qwen2.5:7b    # consigliato (~4.7 GB)
# oppure
ollama pull llama3.1:8b
ollama pull mistral-nemo
```

## Struttura

```
ckan-chat/
├── backend/
│   ├── server.js        ← Express + loop Ollama ↔ MCP
│   ├── package.json
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── components/
│   │       ├── ChatMessage.jsx
│   │       ├── ToolCallBadge.jsx
│   │       └── StatusBar.jsx
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── Dockerfile
└── docker-compose.yml
```

## Avvio in sviluppo (raccomandato)

```bash
# 1. Avvia Ollama sul host (se non già in esecuzione)
ollama serve

# 2. Avvia il container MCP (dalla directory del ckan-mcp-server)
docker compose up -d

# 3. Backend
cd backend
npm install
node server.js     # oppure: node --watch server.js

# 4. Frontend (altro terminale)
cd frontend
npm install
npm run dev        # → http://localhost:5173
```

## Avvio con Docker Compose (tutto insieme)

```bash
# Assicurati che Ollama sia in esecuzione sul host
ollama serve

# Build e avvio di tutti i servizi
docker compose up --build -d

# Frontend disponibile su http://localhost:8080
```

## Variabili d'ambiente backend

| Variabile      | Default                        | Descrizione                    |
|----------------|--------------------------------|--------------------------------|
| `OLLAMA_URL`   | `http://localhost:11434`       | URL di Ollama                  |
| `OLLAMA_MODEL` | `qwen2.5:7b`                   | Modello da usare               |
| `MCP_URL`      | `http://192.168.0.88:3000/mcp` | URL del container CKAN MCP     |
| `PORT`         | `3001`                         | Porta backend                  |

Puoi creare un file `.env` nella cartella `backend/`:

```env
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b
MCP_URL=http://192.168.0.88:3000/mcp
PORT=3001
```

## API Backend

| Metodo | Path         | Descrizione                          |
|--------|--------------|--------------------------------------|
| GET    | /api/health  | Stato di backend, Ollama, MCP        |
| GET    | /api/models  | Lista modelli Ollama disponibili     |
| GET    | /api/tools   | Lista strumenti MCP disponibili      |
| POST   | /api/chat    | Invia messaggio, ricevi risposta     |

### POST /api/chat

```json
// Request
{
  "messages": [
    { "role": "user", "content": "Cerca dataset sulla qualità dell'aria" }
  ],
  "model": "qwen2.5:7b"   // opzionale, sovrascrive OLLAMA_MODEL
}

// Response
{
  "reply": "Ho trovato 399 dataset sulla qualità dell'aria...",
  "toolCalls": [
    {
      "tool": "ckan_package_search",
      "args": { "server_url": "https://www.dati.gov.it/opendata", "q": "qualità aria" }
    }
  ]
}
```

## Modelli consigliati per tool calling

| Modello          | Dimensione | Tool calling | Note                    |
|------------------|------------|--------------|-------------------------|
| `qwen2.5:7b`     | 4.7 GB     | ⭐⭐⭐⭐⭐    | Migliore per questo uso |
| `llama3.1:8b`    | 4.9 GB     | ⭐⭐⭐⭐      | Buona alternativa       |
| `mistral-nemo`   | 7.1 GB     | ⭐⭐⭐⭐      | Ottimo in italiano      |
| `qwen2.5:14b`    | 9.0 GB     | ⭐⭐⭐⭐⭐    | Più preciso, più lento  |
