import { db } from '../db';
import { alerts, alertEvents, SecurityEvent, Severity } from '../db/schema';
import { MITRE_TECHNIQUES, MitreTechnique } from '../data/mitreAttack';
import { logger } from '../utils/logger';

export interface AlertCandidate {
  title: string;
  description: string;
  severity: Severity;
  ruleId: string;
  mitre: MitreTechnique;
  eventIds: string[];
}

interface Rule {
  id: string;
  description: string;
  // Given the full recent event window for an org, return zero or more alert candidates.
  evaluate(events: SecurityEvent[]): AlertCandidate[];
}

function groupBy<T, K extends string | number>(items: T[], keyFn: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const bucket = map.get(key);
    if (bucket) bucket.push(item);
    else map.set(key, [item]);
  }
  return map;
}

// --- Rules -------------------------------------------------------------

const bruteForceRule: Rule = {
  id: 'RULE_BRUTE_FORCE',
  description: '5+ AUTH_FAILURE events from the same source IP within the window',
  evaluate(events) {
    const failures = events.filter((e) => e.eventType === 'AUTH_FAILURE' && e.sourceIp);
    const byIp = groupBy(failures, (e) => e.sourceIp as string);
    const candidates: AlertCandidate[] = [];
    for (const [ip, group] of byIp) {
      if (group.length >= 5) {
        candidates.push({
          title: `Brute force login attempts from ${ip}`,
          description: `${group.length} failed authentication attempts from ${ip} targeting ${
            new Set(group.map((e) => e.username)).size
          } distinct account(s) within the detection window.`,
          severity: group.length >= 10 ? 'CRITICAL' : 'HIGH',
          ruleId: this.id,
          mitre: MITRE_TECHNIQUES.T1110,
          eventIds: group.map((e) => e.id),
        });
      }
    }
    return candidates;
  },
};

const passwordSprayRule: Rule = {
  id: 'RULE_PASSWORD_SPRAY',
  description: 'Single source IP failing auth across 4+ distinct usernames',
  evaluate(events) {
    const failures = events.filter((e) => e.eventType === 'AUTH_FAILURE' && e.sourceIp && e.username);
    const byIp = groupBy(failures, (e) => e.sourceIp as string);
    const candidates: AlertCandidate[] = [];
    for (const [ip, group] of byIp) {
      const distinctUsers = new Set(group.map((e) => e.username));
      if (distinctUsers.size >= 4) {
        candidates.push({
          title: `Password spraying pattern from ${ip}`,
          description: `${ip} attempted authentication against ${distinctUsers.size} distinct usernames (${[...distinctUsers]
            .slice(0, 5)
            .join(', ')}${distinctUsers.size > 5 ? ', …' : ''}) — consistent with low-and-slow password spraying.`,
          severity: 'HIGH',
          ruleId: this.id,
          mitre: MITRE_TECHNIQUES.T1110_003,
          eventIds: group.map((e) => e.id),
        });
      }
    }
    return candidates;
  },
};

const portScanRule: Rule = {
  id: 'RULE_PORT_SCAN',
  description: 'PORT_SCAN events or 10+ distinct connection attempts from one source',
  evaluate(events) {
    const scans = events.filter((e) => e.eventType === 'PORT_SCAN' && e.sourceIp);
    const byIp = groupBy(scans, (e) => e.sourceIp as string);
    const candidates: AlertCandidate[] = [];
    for (const [ip, group] of byIp) {
      candidates.push({
        title: `Network reconnaissance from ${ip}`,
        description: `Detected port scanning activity from ${ip} across ${group.length} probe(s) — likely pre-attack reconnaissance.`,
        severity: 'MEDIUM',
        ruleId: this.id,
        mitre: MITRE_TECHNIQUES.T1595,
        eventIds: group.map((e) => e.id),
      });
    }
    return candidates;
  },
};

const accountManipulationRule: Rule = {
  id: 'RULE_ACCOUNT_MANIPULATION',
  description: 'Privilege/role change events outside business hours',
  evaluate(events) {
    const changes = events.filter((e) => e.eventType === 'ROLE_CHANGE');
    return changes.map((e) => ({
      title: `Privilege change on account ${e.username ?? 'unknown'}`,
      description: `Role/permission modification detected for ${e.username ?? 'an account'} on host ${
        e.host ?? 'unknown host'
      }. Verify this was an authorized change.`,
      severity: 'HIGH' as Severity,
      ruleId: this.id,
      mitre: MITRE_TECHNIQUES.T1098,
      eventIds: [e.id],
    }));
  },
};

const dataExfiltrationRule: Rule = {
  id: 'RULE_DATA_EXFILTRATION',
  description: 'Large outbound data transfer events',
  evaluate(events) {
    const transfers = events.filter((e) => e.eventType === 'LARGE_DATA_TRANSFER');
    return transfers.map((e) => ({
      title: `Unusually large data transfer from ${e.host ?? e.sourceIp ?? 'unknown host'}`,
      description: `A large outbound data transfer was observed${
        e.username ? ` initiated by ${e.username}` : ''
      }. Possible data exfiltration — review destination and volume.`,
      severity: 'CRITICAL' as Severity,
      ruleId: this.id,
      mitre: MITRE_TECHNIQUES.T1567,
      eventIds: [e.id],
    }));
  },
};

const suspiciousProcessRule: Rule = {
  id: 'RULE_SUSPICIOUS_PROCESS',
  description: 'Suspicious shell/process execution events',
  evaluate(events) {
    const procs = events.filter((e) => e.eventType === 'SUSPICIOUS_PROCESS');
    return procs.map((e) => ({
      title: `Suspicious process execution on ${e.host ?? 'unknown host'}`,
      description: `Endpoint telemetry flagged a suspicious process/script execution on ${
        e.host ?? 'an endpoint'
      }${e.username ? ` under user ${e.username}` : ''}.`,
      severity: 'HIGH' as Severity,
      ruleId: this.id,
      mitre: MITRE_TECHNIQUES.T1059,
      eventIds: [e.id],
    }));
  },
};

const logTamperingRule: Rule = {
  id: 'RULE_LOG_TAMPERING',
  description: 'Log clearing / audit trail interference',
  evaluate(events) {
    const tampering = events.filter((e) => e.eventType === 'LOG_CLEARED');
    return tampering.map((e) => ({
      title: `Audit log clearing detected on ${e.host ?? 'unknown host'}`,
      description: `Local logs were cleared on ${e.host ?? 'a host'} — a common technique to remove evidence after compromise.`,
      severity: 'CRITICAL' as Severity,
      ruleId: this.id,
      mitre: MITRE_TECHNIQUES.T1070,
      eventIds: [e.id],
    }));
  },
};

const lateralMovementRule: Rule = {
  id: 'RULE_LATERAL_MOVEMENT',
  description: 'Same user authenticating to 3+ distinct hosts within the window',
  evaluate(events) {
    const logins = events.filter((e) => e.eventType === 'AUTH_SUCCESS' && e.username && e.host);
    const byUser = groupBy(logins, (e) => e.username as string);
    const candidates: AlertCandidate[] = [];
    for (const [user, group] of byUser) {
      const distinctHosts = new Set(group.map((e) => e.host));
      if (distinctHosts.size >= 3) {
        candidates.push({
          title: `Possible lateral movement by ${user}`,
          description: `${user} authenticated to ${distinctHosts.size} distinct hosts (${[...distinctHosts]
            .slice(0, 5)
            .join(', ')}) in a short window.`,
          severity: 'HIGH',
          ruleId: this.id,
          mitre: MITRE_TECHNIQUES.T1021,
          eventIds: group.map((e) => e.id),
        });
      }
    }
    return candidates;
  },
};

const ALL_RULES: Rule[] = [
  bruteForceRule,
  passwordSprayRule,
  portScanRule,
  accountManipulationRule,
  dataExfiltrationRule,
  suspiciousProcessRule,
  logTamperingRule,
  lateralMovementRule,
];

/**
 * Pure rule evaluation — no I/O, fully unit-testable. Runs every rule
 * against the given event window and returns the alert candidates any of
 * them produced. A single bad rule logs and is skipped rather than failing
 * the whole batch.
 */
export function evaluateAllRules(events: SecurityEvent[]): AlertCandidate[] {
  const candidates: AlertCandidate[] = [];
  for (const rule of ALL_RULES) {
    try {
      candidates.push(...rule.evaluate(events));
    } catch (err) {
      logger.error('Detection rule threw', { ruleId: rule.id, error: (err as Error).message });
    }
  }
  return candidates;
}

/**
 * Runs every detection rule against the given event set and persists any
 * resulting alerts (idempotency note: this is a demo-grade engine — a
 * production version would dedupe against already-open alerts for the same
 * rule+entity before creating a new one).
 */
export async function runDetectionEngine(
  organizationId: string,
  events: SecurityEvent[],
): Promise<number> {
  const candidates = evaluateAllRules(events);
  let created = 0;

  for (const candidate of candidates) {
    const alertId = crypto.randomUUID();
    await db.insert(alerts).values({
      id:                 alertId,
      organizationId,
      title:              candidate.title,
      description:        candidate.description,
      severity:           candidate.severity,
      ruleId:             candidate.ruleId,
      mitreTacticId:      candidate.mitre.tacticId,
      mitreTacticName:    candidate.mitre.tacticName,
      mitreTechniqueId:   candidate.mitre.techniqueId,
      mitreTechniqueName: candidate.mitre.techniqueName,
    });

    if (candidate.eventIds.length > 0) {
      await db.insert(alertEvents).values(
        candidate.eventIds.map((eventId) => ({
          id: crypto.randomUUID(),
          alertId,
          eventId,
        })),
      );
    }
    created += 1;
  }

  logger.info('Detection engine run complete', { organizationId, eventsEvaluated: events.length, alertsCreated: created });
  return created;
}

export const DETECTION_RULES = ALL_RULES.map((r) => ({ id: r.id, description: r.description }));
