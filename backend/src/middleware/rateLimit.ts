import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

// General API limiter — generous, just to blunt abuse/scraping.
export const apiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, slow down.' },
});

// Strict limiter for auth endpoints — mitigates credential stuffing / brute force.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Try again in 15 minutes.' },
});

// Higher-cost limiter for AI triage calls — these hit the OpenAI API and cost money.
export const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'AI triage rate limit exceeded, try again shortly.' },
});
