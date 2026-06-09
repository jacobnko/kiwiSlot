# syntax=docker/dockerfile:1

# ---------- Stage 1: builder ----------
# Installs ALL dependencies (incl. dev), generates the Prisma client, and compiles
# the TypeScript to plain JS in /app/dist.
FROM node:22-slim AS builder
WORKDIR /app

# Install dependencies first (better layer caching: only re-runs when lockfile changes).
COPY package*.json ./
RUN npm ci

# Generate the Prisma client from the schema, then build the Nest app.
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
RUN npm run build

# ---------- Stage 2: runner ----------
# A lean production image: only prod dependencies + the compiled app.
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Prisma's query engine needs OpenSSL at runtime.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# Install production dependencies only. The `prisma` CLI is a prod dependency so the
# container can run migrations on startup.
COPY package*.json ./
RUN npm ci --omit=dev

# Regenerate the Prisma client against the prod node_modules, then copy the build output.
COPY prisma ./prisma
RUN npx prisma generate
COPY --from=builder /app/dist ./dist

# Default app port (overridable via the PORT env var).
EXPOSE 3333

# Apply any pending migrations, then start the server. Makes the container self-sufficient
# on any host (DATABASE_URL, JWT_SECRET, PORT come from the environment).
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
