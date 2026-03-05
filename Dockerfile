# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copia solo i file di dipendenze prima (layer cache)
COPY package*.json ./
RUN npm ci

# Copia tutto il sorgente e compila
COPY . .
RUN npm run build

# ─── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /app

# Installa solo le dipendenze di produzione
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copia i file compilati dallo stage di build
COPY --from=builder /app/dist ./dist

# Copia eventuali asset statici necessari a runtime
COPY --from=builder /app/src/portals.json ./src/portals.json 2>/dev/null || true

# Variabili d'ambiente con valori di default
ENV NODE_ENV=production
ENV TRANSPORT=http
ENV PORT=3000

# Espone la porta HTTP del server MCP
EXPOSE 3000

# Healthcheck: verifica che il server risponda
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:${PORT}/health 2>/dev/null || \
      curl -sf -X POST http://localhost:${PORT}/mcp \
        -H 'Content-Type: application/json' \
        -d '{"jsonrpc":"2.0","method":"ping","id":1}' || exit 1

# Utente non-root per sicurezza
USER node

CMD ["node", "dist/index.js"]
