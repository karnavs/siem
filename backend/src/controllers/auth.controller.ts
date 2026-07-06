import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { recordAudit } from '../services/auditService';
import { ApiError } from '../middleware/errorHandler';

const SALT_ROUNDS = 12;

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1),
  organizationName: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const body = registerSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) throw new ApiError(409, 'An account with this email already exists');

    const passwordHash = await bcrypt.hash(body.password, SALT_ROUNDS);

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // First user in an org is provisioned as ADMIN.
      const org = await tx.organization.create({ data: { name: body.organizationName } });
      const user = await tx.user.create({
        data: {
          email: body.email,
          passwordHash,
          name: body.name,
          role: 'ADMIN',
          organizationId: org.id,
        },
      });
      return user;
    });

    await recordAudit({ userId: result.id, action: 'USER_REGISTERED', ipAddress: req.ip });

    const accessToken = signAccessToken({
      sub: result.id,
      email: result.email,
      role: result.role,
      organizationId: result.organizationId,
    });
    const refreshToken = signRefreshToken(result.id);

    return res.status(201).json({
      accessToken,
      refreshToken,
      user: { id: result.id, email: result.email, name: result.name, role: result.role },
    });
  } catch (err) {
    return next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const body = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: body.email } });

    // Constant-shape response on invalid email/password to avoid user enumeration.
    if (!user) throw new ApiError(401, 'Invalid email or password');

    const valid = await bcrypt.compare(body.password, user.passwordHash);
    if (!valid) {
      await recordAudit({ action: 'LOGIN_FAILED', metadata: { email: body.email }, ipAddress: req.ip });
      throw new ApiError(401, 'Invalid email or password');
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await recordAudit({ userId: user.id, action: 'LOGIN_SUCCESS', ipAddress: req.ip });

    const accessToken = signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    });
    const refreshToken = signRefreshToken(user.id);

    return res.json({
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (err) {
    return next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (!refreshToken) throw new ApiError(400, 'refreshToken is required');

    const payload = verifyRefreshToken(refreshToken);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new ApiError(401, 'User no longer exists');

    const accessToken = signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    });

    return res.json({ accessToken });
  } catch {
    return next(new ApiError(401, 'Invalid or expired refresh token'));
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new ApiError(401, 'Not authenticated');
    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      select: { id: true, email: true, name: true, role: true, organizationId: true, lastLoginAt: true },
    });
    if (!user) throw new ApiError(404, 'User not found');
    return res.json({ user });
  } catch (err) {
    return next(err);
  }
}
