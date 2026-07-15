import { Alert, SecurityEvent } from '../src/db/schema';
import { triageAlert } from '../src/services/aiTriage';

function makeAlert(overrides: Partial<Alert>): Alert {
  return {
    id: 'alert-1',
    organizationId: 'org-1',
    title: 'Brute force login attempts from 198.51.100.1',
    description: '10 failed authentication attempts',
    severity: 'CRITICAL',
    status: 'OPEN',
    ruleId: 'RULE_BRUTE_FORCE',
    mitreTacticId: 'TA0006',
    mitreTacticName: 'Credential Access',
    mitreTechniqueId: 'T1110',
    mitreTechniqueName: 'Brute Force',
    aiSummary: null,
    aiRecommendation: null,
    aiConfidence: null,
    acknowledgedById: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Alert;
}

describe('aiTriage — mock mode (no OPENAI_API_KEY)', () => {
  const originalKey = process.env.OPENAI_API_KEY;

  beforeAll(() => {
    delete process.env.OPENAI_API_KEY;
  });

  afterAll(() => {
    if (originalKey) process.env.OPENAI_API_KEY = originalKey;
  });

  it('returns a deterministic mock result without calling any external API', async () => {
    const alert = makeAlert({ severity: 'CRITICAL' });
    const result = await triageAlert({ alert, events: [] as SecurityEvent[] });

    expect(result.mode).toBe('mock');
    expect(result.summary).toContain(alert.title);
    expect(result.confidence).toBeGreaterThan(0.8);
    expect(result.recommendation.toLowerCase()).toContain('escalate');
  });

  it('scales recommendation tone with severity', async () => {
    const low = await triageAlert({ alert: makeAlert({ severity: 'LOW' }), events: [] });
    const critical = await triageAlert({ alert: makeAlert({ severity: 'CRITICAL' }), events: [] });

    expect(low.confidence).toBeLessThan(critical.confidence);
  });
});
