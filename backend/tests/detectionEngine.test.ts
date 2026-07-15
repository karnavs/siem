import { SecurityEvent } from '../src/db/schema';
import { evaluateAllRules } from '../src/services/detectionEngine';

let idCounter = 0;
function makeEvent(overrides: Partial<SecurityEvent>): SecurityEvent {
  idCounter += 1;
  return {
    id: `evt-${idCounter}`,
    organizationId: 'org-1',
    source: 'auth-service',
    eventType: 'AUTH_FAILURE',
    sourceIp: '203.0.113.10',
    username: 'j.doe',
    host: 'web-01',
    rawMessage: 'test event',
    metadata: null,
    occurredAt: new Date(),
    createdAt: new Date(),
    ...overrides,
  } as SecurityEvent;
}

describe('detection engine — brute force rule', () => {
  it('flags 5+ AUTH_FAILURE events from the same source IP', () => {
    const events = Array.from({ length: 5 }, () =>
      makeEvent({ eventType: 'AUTH_FAILURE', sourceIp: '198.51.100.1', username: 'admin' }),
    );

    const candidates = evaluateAllRules(events);
    const bruteForce = candidates.find((c) => c.ruleId === 'RULE_BRUTE_FORCE');

    expect(bruteForce).toBeDefined();
    expect(bruteForce?.mitre.techniqueId).toBe('T1110');
    expect(bruteForce?.severity).toBe('HIGH');
  });

  it('escalates to CRITICAL at 10+ failed attempts', () => {
    const events = Array.from({ length: 10 }, () =>
      makeEvent({ eventType: 'AUTH_FAILURE', sourceIp: '198.51.100.1' }),
    );
    const candidates = evaluateAllRules(events);
    const bruteForce = candidates.find((c) => c.ruleId === 'RULE_BRUTE_FORCE');
    expect(bruteForce?.severity).toBe('CRITICAL');
  });

  it('does not flag fewer than 5 failures', () => {
    const events = Array.from({ length: 4 }, () =>
      makeEvent({ eventType: 'AUTH_FAILURE', sourceIp: '198.51.100.1' }),
    );
    const candidates = evaluateAllRules(events);
    expect(candidates.find((c) => c.ruleId === 'RULE_BRUTE_FORCE')).toBeUndefined();
  });
});

describe('detection engine — password spray rule', () => {
  it('flags one IP failing auth across 4+ distinct usernames', () => {
    const users = ['alice', 'bob', 'carol', 'dave'];
    const events = users.map((u) =>
      makeEvent({ eventType: 'AUTH_FAILURE', sourceIp: '203.0.113.55', username: u }),
    );
    const candidates = evaluateAllRules(events);
    const spray = candidates.find((c) => c.ruleId === 'RULE_PASSWORD_SPRAY');
    expect(spray).toBeDefined();
    expect(spray?.mitre.techniqueId).toBe('T1110.003');
  });
});

describe('detection engine — data exfiltration rule', () => {
  it('flags LARGE_DATA_TRANSFER as CRITICAL', () => {
    const events = [makeEvent({ eventType: 'LARGE_DATA_TRANSFER', host: 'workstation-14' })];
    const candidates = evaluateAllRules(events);
    const exfil = candidates.find((c) => c.ruleId === 'RULE_DATA_EXFILTRATION');
    expect(exfil?.severity).toBe('CRITICAL');
    expect(exfil?.mitre.techniqueId).toBe('T1567');
  });
});

describe('detection engine — lateral movement rule', () => {
  it('flags one user authenticating to 3+ distinct hosts', () => {
    const hosts = ['web-01', 'web-02', 'db-primary'];
    const events = hosts.map((h) =>
      makeEvent({ eventType: 'AUTH_SUCCESS', username: 'r.patel', host: h }),
    );
    const candidates = evaluateAllRules(events);
    const lateral = candidates.find((c) => c.ruleId === 'RULE_LATERAL_MOVEMENT');
    expect(lateral).toBeDefined();
    expect(lateral?.mitre.techniqueId).toBe('T1021');
  });

  it('does not flag a user on a single host', () => {
    const events = [makeEvent({ eventType: 'AUTH_SUCCESS', username: 'r.patel', host: 'web-01' })];
    const candidates = evaluateAllRules(events);
    expect(candidates.find((c) => c.ruleId === 'RULE_LATERAL_MOVEMENT')).toBeUndefined();
  });
});

describe('detection engine — benign traffic', () => {
  it('produces no alerts for ordinary, low-volume activity', () => {
    const events = [
      makeEvent({ eventType: 'AUTH_SUCCESS', username: 'j.doe', host: 'web-01', sourceIp: '10.0.1.5' }),
      makeEvent({ eventType: 'AUTH_FAILURE', username: 'j.doe', host: 'web-01', sourceIp: '10.0.1.5' }),
    ];
    const candidates = evaluateAllRules(events);
    expect(candidates).toHaveLength(0);
  });
});
