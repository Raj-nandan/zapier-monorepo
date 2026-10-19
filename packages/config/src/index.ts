import { env } from "./env";

export { env };

export const config = {
  env: env.NODE_ENV,
  databaseUrl: env.DATABASE_URL,
  kafkaBrokers: env.KAFKA_BROKERS,
  topic: env.TOPIC,
  redisUrl: env.REDIS_URL,
  backendUrl: env.BACKEND_URL,
  hooksUrl: env.HOOKS_URL,
  webUrl: env.WEB_URL,
  jwtPassword: env.JWT_PASSWORD,
  tokenEncKey: env.TOKEN_ENC_KEY,
  oauthRedirectUrl: env.OAUTH_REDIRECT_URL,
  port: {
    web: 3000,
    api: 3001,
    hooks: 3002,
  },
} as const;
