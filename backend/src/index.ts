import { createApp } from './app';
import { env } from './config/env';
import { logger } from './utils/logger';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`SentryGrid backend listening`, { port: env.PORT, env: env.NODE_ENV });
});

function shutdown(signal: string) {
  logger.info('Shutting down', { signal });
  server.close(() => process.exit(0));
  // Force-exit if graceful shutdown hangs.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
