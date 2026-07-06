import { prisma } from '../config/prisma';
import { logger } from '../utils/logger';

interface AuditEntry {
  userId?: string;
  action: string;
  resource?: string;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Writes an immutable audit log entry. Never throws — audit logging failures
 * should never break the user-facing request, but they are logged loudly
 * since a gap in the audit trail is itself a finding.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId,
        action: entry.action,
        resource: entry.resource,
        ipAddress: entry.ipAddress,
        metadata: entry.metadata as never,
      },
    });
  } catch (err) {
    logger.error('Failed to write audit log entry', {
      action: entry.action,
      error: (err as Error).message,
    });
  }
}
