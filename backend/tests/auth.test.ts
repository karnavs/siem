import { signAccessToken, verifyAccessToken, signRefreshToken, verifyRefreshToken } from '../src/utils/jwt';
import { requireRole, requireMinRole } from '../src/middleware/auth';
import { Request, Response } from 'express';

describe('jwt utils', () => {
  it('signs and verifies an access token round-trip', () => {
    const payload = { sub: 'user-1', email: 'a@b.com', role: 'ANALYST' as const, organizationId: 'org-1' };
    const token = signAccessToken(payload);
    const decoded = verifyAccessToken(token);
    expect(decoded.sub).toBe('user-1');
    expect(decoded.role).toBe('ANALYST');
  });

  it('rejects a tampered token', () => {
    const token = signAccessToken({ sub: 'u', email: 'a@b.com', role: 'VIEWER', organizationId: 'org-1' });
    expect(() => verifyAccessToken(token + 'tampered')).toThrow();
  });

  it('signs and verifies a refresh token', () => {
    const token = signRefreshToken('user-42');
    const decoded = verifyRefreshToken(token);
    expect(decoded.sub).toBe('user-42');
  });
});

function mockRes() {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

describe('RBAC middleware', () => {
  it('requireRole allows a permitted role through', () => {
    const req = { user: { sub: 'u', email: 'a@b.com', role: 'ADMIN', organizationId: 'org-1' } } as unknown as Request;
    const res = mockRes();
    const next = jest.fn();

    requireRole('ADMIN', 'ANALYST')(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('requireRole blocks a role not in the allowlist', () => {
    const req = { user: { sub: 'u', email: 'a@b.com', role: 'VIEWER', organizationId: 'org-1' } } as unknown as Request;
    const res = mockRes();
    const next = jest.fn();

    requireRole('ADMIN')(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('requireMinRole treats ADMIN as satisfying an ANALYST floor', () => {
    const req = { user: { sub: 'u', email: 'a@b.com', role: 'ADMIN', organizationId: 'org-1' } } as unknown as Request;
    const res = mockRes();
    const next = jest.fn();

    requireMinRole('ANALYST')(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('requireMinRole blocks VIEWER from an ANALYST-floor route', () => {
    const req = { user: { sub: 'u', email: 'a@b.com', role: 'VIEWER', organizationId: 'org-1' } } as unknown as Request;
    const res = mockRes();
    const next = jest.fn();

    requireMinRole('ANALYST')(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
