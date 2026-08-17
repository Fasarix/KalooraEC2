FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

FROM node:20-alpine AS runner
WORKDIR /app
RUN addgroup -g 10001 -S nodejs && adduser -S nodejs -u 10001 -G nodejs
COPY --from=builder /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs . .
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5003/health || exit 1

USER nodejs
EXPOSE 5003
CMD ["node", "index.js"]

