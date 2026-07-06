import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { env } from './config/env';
import { apiLimiter } from './middleware/rateLimit';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

import authRoutes from './routes/auth.routes';
import logsRoutes from './routes/logs.routes';
import alertsRoutes from './routes/alerts.routes';
import dashboardRoutes from './routes/dashboard.routes';
import auditRoutes from './routes/audit.routes';

export function createApp(): Application {
  const app = express();

  // --- Security middleware ----------------------------------------------
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
  app.use(apiLimiter);

  // --- Health check (used by ECS task health checks / ALB target group) --
  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'sentrygrid-backend' }));

  // --- API routes ----------------------------------------------------------
  app.use('/api/auth', authRoutes);
  app.use('/api/logs', logsRoutes);
  app.use('/api/alerts', alertsRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/audit', auditRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
