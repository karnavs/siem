import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, AccessTokenPayload } from '../utils/jwt';
import { logger } from '../utils/logger';
import { Role } from '../db/schema';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

/**
 * Verifies the JWT access token on protected routes and attaches the decoded
 * payload to req.user. Returns 401 on missing/invalid/expired tokens.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  const token = header.slice('Bearer '.length);

  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    return next();
  } catch (err) {
    logger.warn('Access token verification failed', { reason: (err as Error).message });
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Role-based access control. Usage: requireRole('ADMIN') or
 * requireRole('ADMIN', 'ANALYST') for "any of".
 * Must run after requireAuth.
 */
export function requireRole(...allowed: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!allowed.includes(req.user.role)) {
      logger.warn('RBAC denied', { userId: req.user.sub, role: req.user.role, required: allowed });
      return res.status(403).json({ error: 'Insufficient permissions for this action' });
    }
    return next();
  };
}

// Role hierarchy helper: ADMIN > ANALYST > VIEWER, for "at least this level" checks.
const ROLE_RANK: Record<Role, number> = { VIEWER: 0, ANALYST: 1, ADMIN: 2 };

export function requireMinRole(minRole: Role) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (ROLE_RANK[req.user.role] < ROLE_RANK[minRole]) {
      return res.status(403).json({ error: `Requires ${minRole} role or higher` });
    }
    return next();
  };
}
