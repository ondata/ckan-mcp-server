# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency files first (layer cache)
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# ─── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled files from build stage
COPY --from=builder /app/dist ./dist

# Default environment variables
ENV NODE_ENV=production
ENV TRANSPORT=stdio

# Run as non-root user for security
USER node

CMD ["node", "dist/index.js"]
