import bcrypt from 'bcryptjs';
import { db } from '../db';
import { organizations, users, securityEvents, alerts, alertEvents, auditLogs } from '../db/schema';
import { runDetectionEngine } from '../services/detectionEngine';
import { logger } from '../utils/logger';

const DEMO_PASSWORD = 'Password123!';

const EVENT_TYPES = [
  'AUTH_FAILURE',
  'AUTH_SUCCESS',
  'PORT_SCAN',
  'ROLE_CHANGE',
  'LARGE_DATA_TRANSFER',
  'SUSPICIOUS_PROCESS',
  'LOG_CLEARED',
] as const;

const USERNAMES = ['j.doe', 'a.smith', 'r.patel', 'k.chen', 'm.garcia', 'admin', 's.iyer'];
const HOSTS = ['web-01', 'web-02', 'db-primary', 'vpn-gw-1', 'workstation-14', 'workstation-22'];
const NORMAL_IPS = ['10.0.1.12', '10.0.1.45', '10.0.2.8'];
const SUSPICIOUS_IPS = ['185.220.101.7', '45.155.205.23', '194.61.24.18'];

function randomFrom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomRecentDate(maxDaysAgo: number): Date {
  const ms = Math.random() * maxDaysAgo * 24 * 60 * 60 * 1000;
  return new Date(Date.now() - ms);
}

async function main() {
  logger.info('Seeding SentryGrid demo data...');

  // Wipe existing demo data for idempotent re-seeds in dev.
  await db.delete(auditLogs);
  await db.delete(alertEvents);
  await db.delete(alerts);
  await db.delete(securityEvents);
  await db.delete(users);
  await db.delete(organizations);

  const [org] = await db.insert(organizations).values({
    id: crypto.randomUUID(),
    name: 'SentryGrid Demo Corp',
  }).returning();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  await db.insert(users).values([
    { id: crypto.randomUUID(), email: 'admin@sentrygrid.io', name: 'Avery Admin', role: 'ADMIN', passwordHash, organizationId: org.id },
    { id: crypto.randomUUID(), email: 'analyst@sentrygrid.io', name: 'Sam Analyst', role: 'ANALYST', passwordHash, organizationId: org.id },
    { id: crypto.randomUUID(), email: 'viewer@sentrygrid.io', name: 'Val Viewer', role: 'VIEWER', passwordHash, organizationId: org.id },
  ]);

  // --- Background noise: a few hundred mostly-benign events ---------------
  const events = [];
  for (let i = 0; i < 350; i++) {
    const eventType = randomFrom(EVENT_TYPES.filter((t) => !['LOG_CLEARED'].includes(t)));
    events.push({
      id: crypto.randomUUID(),
      organizationId: org.id,
      source: randomFrom(['auth-service', 'endpoint-agent', 'vpn-gateway', 'firewall']),
      eventType,
      sourceIp: randomFrom(NORMAL_IPS),
      username: randomFrom(USERNAMES),
      host: randomFrom(HOSTS),
      rawMessage: `${eventType} observed on ${randomFrom(HOSTS)}`,
      occurredAt: randomRecentDate(14),
    });
  }

  // --- Planted attack scenario 1: brute force + password spray ------------
  const attackerIp = SUSPICIOUS_IPS[0];
  for (let i = 0; i < 8; i++) {
    events.push({
      id: crypto.randomUUID(),
      organizationId: org.id,
      source: 'auth-service',
      eventType: 'AUTH_FAILURE',
      sourceIp: attackerIp,
      username: 'admin',
      host: 'web-01',
      rawMessage: `Failed login for admin from ${attackerIp}`,
      occurredAt: randomRecentDate(1),
    });
  }
  for (const user of USERNAMES.slice(0, 5)) {
    events.push({
      id: crypto.randomUUID(),
      organizationId: org.id,
      source: 'auth-service',
      eventType: 'AUTH_FAILURE',
      sourceIp: SUSPICIOUS_IPS[1],
      username: user,
      host: 'web-02',
      rawMessage: `Failed login for ${user} from ${SUSPICIOUS_IPS[1]}`,
      occurredAt: randomRecentDate(1),
    });
  }

  // --- Planted attack scenario 2: recon + lateral movement -----------------
  for (let i = 0; i < 4; i++) {
    events.push({
      id: crypto.randomUUID(),
      organizationId: org.id,
      source: 'firewall',
      eventType: 'PORT_SCAN',
      sourceIp: SUSPICIOUS_IPS[2],
      host: 'db-primary',
      rawMessage: `Port scan probe ${i + 1} from ${SUSPICIOUS_IPS[2]}`,
      occurredAt: randomRecentDate(2),
    });
  }
  for (const host of ['web-01', 'web-02', 'db-primary']) {
    events.push({
      id: crypto.randomUUID(),
      organizationId: org.id,
      source: 'endpoint-agent',
      eventType: 'AUTH_SUCCESS',
      sourceIp: NORMAL_IPS[0],
      username: 'r.patel',
      host,
      rawMessage: `r.patel authenticated to ${host}`,
      occurredAt: randomRecentDate(1),
    });
  }

  // --- Planted attack scenario 3: critical incidents ------------------------
  events.push({
    id: crypto.randomUUID(),
    organizationId: org.id,
    source: 'endpoint-agent',
    eventType: 'LARGE_DATA_TRANSFER',
    sourceIp: NORMAL_IPS[1],
    username: 'm.garcia',
    host: 'workstation-14',
    rawMessage: '2.3GB outbound transfer to unrecognized external endpoint',
    occurredAt: randomRecentDate(1),
  });
  events.push({
    id: crypto.randomUUID(),
    organizationId: org.id,
    source: 'endpoint-agent',
    eventType: 'LOG_CLEARED',
    host: 'db-primary',
    rawMessage: 'Local audit log cleared via admin console',
    occurredAt: randomRecentDate(1),
  });
  events.push({
    id: crypto.randomUUID(),
    organizationId: org.id,
    source: 'endpoint-agent',
    eventType: 'SUSPICIOUS_PROCESS',
    username: 's.iyer',
    host: 'workstation-22',
    rawMessage: 'PowerShell launched with encoded command argument',
    occurredAt: randomRecentDate(1),
  });
  events.push({
    id: crypto.randomUUID(),
    organizationId: org.id,
    source: 'iam-service',
    eventType: 'ROLE_CHANGE',
    username: 'k.chen',
    host: 'iam-console',
    rawMessage: 'k.chen granted elevated admin privileges',
    occurredAt: randomRecentDate(1),
  });

  await db.insert(securityEvents).values(events);
  logger.info(`Inserted ${events.length} synthetic security events`);

  const allEvents = await db.select().from(securityEvents).where(eq(securityEvents.organizationId, org.id));
  const alertsCreated = await runDetectionEngine(org.id, allEvents);
  logger.info(`Detection engine generated ${alertsCreated} alerts from seed data`);

  logger.info('Seed complete.', {
    org: org.name,
    logins: [
      'admin@sentrygrid.io / Password123!',
      'analyst@sentrygrid.io / Password123!',
      'viewer@sentrygrid.io / Password123!',
    ],
  });
}

main()
  .catch((err) => {
    logger.error('Seed failed', { error: (err as Error).message });
    process.exit(1);
  });
