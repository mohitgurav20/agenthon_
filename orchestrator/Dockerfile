# Build Stage
FROM node:18-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --only=production

# Run Stage
FROM node:18-alpine

WORKDIR /usr/src/app

COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY package*.json ./
COPY orchestrator/ ./orchestrator/
COPY memory/ ./memory/
COPY scripts/ ./scripts/

EXPOSE 3002

CMD ["node", "orchestrator/server.js"]
