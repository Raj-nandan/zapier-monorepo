FROM oven/bun:1 AS base
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install
COPY . .
CMD ["bun", "run", "dev"]
