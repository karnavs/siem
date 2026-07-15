import { pgTable, pgEnum, text, timestamp, json, doublePrecision, index, uniqueIndex } from 'drizzle-orm/pg-core';

// ─── Enums ────────────────────────────────────────────────────────────────────
export const roleEnum = pgEnum('Role', ['ADMIN', 'ANALYST', 'VIEWER']);
export const severityEnum = pgEnum('Severity', ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export const alertStatusEnum = pgEnum('AlertStatus', ['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'FALSE_POSITIVE']);

// ─── Tables ───────────────────────────────────────────────────────────────────
export const organizations = pgTable('Organization', {
  id:        text('id').primaryKey(),
  name:      text('name').notNull(),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable('User', {
  id:             text('id').primaryKey(),
  email:          text('email').notNull().unique(),
  passwordHash:   text('passwordHash').notNull(),
  name:           text('name').notNull(),
  role:           roleEnum('role').notNull().default('VIEWER'),
  organizationId: text('organizationId').notNull().references(() => organizations.id),
  createdAt:      timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt:    timestamp('lastLoginAt', { withTimezone: true }),
});

export const securityEvents = pgTable('SecurityEvent', {
  id:             text('id').primaryKey(),
  organizationId: text('organizationId').notNull().references(() => organizations.id),
  source:         text('source').notNull(),
  eventType:      text('eventType').notNull(),
  sourceIp:       text('sourceIp'),
  username:       text('username'),
  host:           text('host'),
  rawMessage:     text('rawMessage').notNull(),
  metadata:       json('metadata'),
  occurredAt:     timestamp('occurredAt', { withTimezone: true }).notNull().defaultNow(),
  createdAt:      timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  orgOccurredIdx: index('SecurityEvent_organizationId_occurredAt_idx').on(t.organizationId, t.occurredAt),
  eventTypeIdx:   index('SecurityEvent_eventType_idx').on(t.eventType),
  sourceIpIdx:    index('SecurityEvent_sourceIp_idx').on(t.sourceIp),
}));

export const alerts = pgTable('Alert', {
  id:                  text('id').primaryKey(),
  organizationId:      text('organizationId').notNull().references(() => organizations.id),
  title:               text('title').notNull(),
  description:         text('description').notNull(),
  severity:            severityEnum('severity').notNull(),
  status:              alertStatusEnum('status').notNull().default('OPEN'),
  ruleId:              text('ruleId').notNull(),
  mitreTacticId:       text('mitreTacticId'),
  mitreTacticName:     text('mitreTacticName'),
  mitreTechniqueId:    text('mitreTechniqueId'),
  mitreTechniqueName:  text('mitreTechniqueName'),
  aiSummary:           text('aiSummary'),
  aiRecommendation:    text('aiRecommendation'),
  aiConfidence:        doublePrecision('aiConfidence'),
  acknowledgedById:    text('acknowledgedById').references(() => users.id),
  createdAt:           timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  orgCreatedIdx: index('Alert_organizationId_createdAt_idx').on(t.organizationId, t.createdAt),
  severityIdx:   index('Alert_severity_idx').on(t.severity),
  statusIdx:     index('Alert_status_idx').on(t.status),
}));

export const alertEvents = pgTable('AlertEvent', {
  id:      text('id').primaryKey(),
  alertId: text('alertId').notNull().references(() => alerts.id, { onDelete: 'cascade' }),
  eventId: text('eventId').notNull().references(() => securityEvents.id, { onDelete: 'cascade' }),
}, (t) => ({
  uniqueAlertEvent: uniqueIndex('AlertEvent_alertId_eventId_key').on(t.alertId, t.eventId),
}));

export const auditLogs = pgTable('AuditLog', {
  id:             text('id').primaryKey(),
  organizationId: text('organizationId').notNull().references(() => organizations.id),
  userId:         text('userId').references(() => users.id),
  action:         text('action').notNull(),
  resource:       text('resource'),
  ipAddress:      text('ipAddress'),
  metadata:       json('metadata'),
  createdAt:      timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  orgCreatedIdx:  index('AuditLog_organizationId_createdAt_idx').on(t.organizationId, t.createdAt),
  userCreatedIdx: index('AuditLog_userId_createdAt_idx').on(t.userId, t.createdAt),
  actionIdx:      index('AuditLog_action_idx').on(t.action),
}));

// ─── Inferred Types ───────────────────────────────────────────────────────────
export type Organization  = typeof organizations.$inferSelect;
export type User          = typeof users.$inferSelect;
export type SecurityEvent = typeof securityEvents.$inferSelect;
export type Alert         = typeof alerts.$inferSelect;
export type AuditLog      = typeof auditLogs.$inferSelect;
export type Role          = 'ADMIN' | 'ANALYST' | 'VIEWER';
export type Severity      = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AlertStatus   = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'FALSE_POSITIVE';
