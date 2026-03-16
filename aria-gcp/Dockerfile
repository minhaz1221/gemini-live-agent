# ── ARIA Backend — Dockerfile for Google Cloud Run ───────────────────────────
# Build:   docker build -t aria-agent .
# Run:     docker run -p 8080:8080 aria-agent
# Deploy:  gcloud run deploy aria-agent --source .

FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application source
COPY . .

# Cloud Run expects port 8080
ENV PORT=8080
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Start the server
CMD ["node", "server/index.js"]
