FROM oven/bun:1 AS base
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/
COPY apps/hooks/package.json ./apps/hooks/
COPY apps/processor/package.json ./apps/processor/
COPY apps/worker/package.json ./apps/worker/
COPY apps/scheduler/package.json ./apps/scheduler/
COPY packages/db/package.json ./packages/db/
COPY packages/kafka/package.json ./packages/kafka/
COPY packages/schemas/package.json ./packages/schemas/
COPY packages/triggers/package.json ./packages/triggers/
COPY packages/actions/package.json ./packages/actions/
COPY packages/logger/package.json ./packages/logger/
COPY packages/config/package.json ./packages/config/
RUN bun install
COPY . .
EXPOSE 3001
CMD ["bun", "run", "dev"]
