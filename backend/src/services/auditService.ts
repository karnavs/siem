import { db } from '../db';
import { logger } from '../utils/logger';
import { auditLogs } from '../db/schema';

interface AuditEntry {
  organizationId: string;
  userId?: string;
  action: string;
  resource?: string;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Writes an immutable audit log entry. Never throws - audit logging failures
 * should never break the user-facing request, but they are logged loudly
 * since a gap in the audit trail is itself a finding.
 *
 * organizationId is required so that audit records are always scoped to a
 * tenant - this is what /api/audit filters on to prevent cross-org leakage.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      id:             crypto.randomUUID(),
      organizationId: entry.organizationId,
      userId:         entry.userId,
      action:         entry.action,
      resource:       entry.resource,
      ipAddress:      entry.ipAddress,
      metadata:       entry.metadata ?? null,
    });
  } catch (err) {
    logger.error('Failed to write audit log entry', {
      action: entry.action,
      error: (err as Error).message,
    });
  }
}
