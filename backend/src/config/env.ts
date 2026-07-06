import dotenv from 'dotenv';
dotenv.config();

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: parseInt(process.env.PORT ?? '4000', 10),
  DATABASE_URL: required('DATABASE_URL', 'postgresql://sentrygrid:sentrygrid@localhost:5432/sentrygrid'),
  JWT_ACCESS_SECRET: required('JWT_ACCESS_SECRET', 'dev-access-secret-change-me'),
  JWT_REFRESH_SECRET: required('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-me'),
  JWT_ACCESS_EXPIRY: process.env.JWT_ACCESS_EXPIRY ?? '15m',
  JWT_REFRESH_EXPIRY: process.env.JWT_REFRESH_EXPIRY ?? '7d',
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? '',
  AI_MODEL: process.env.AI_MODEL ?? 'gpt-4o-mini',
  AWS_REGION: process.env.AWS_REGION ?? 'ap-south-1',
  SNS_ALERT_TOPIC_ARN: process.env.SNS_ALERT_TOPIC_ARN ?? '',
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10),
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX ?? '100', 10),
};

export const isProduction = env.NODE_ENV === 'production';
export const hasAiKey = env.OPENAI_API_KEY.length > 0;
