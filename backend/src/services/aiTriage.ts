import { Alert, SecurityEvent } from '@prisma/client';
import { env, hasAiKey } from '../config/env';
import { logger } from '../utils/logger';

export interface TriageResult {
  summary: string;
  recommendation: string;
  confidence: number; // 0..1
  mode: 'live' | 'mock';
}

interface TriageInput {
  alert: Alert;
  events: SecurityEvent[];
}

const SYSTEM_PROMPT = `You are a senior SOC (Security Operations Center) analyst assistant embedded in a SIEM platform called SentryGrid.
Given a correlated security alert and its underlying raw events, produce:
1. A concise 2-3 sentence summary of what happened, written for a security analyst audience.
2. A specific, actionable remediation recommendation (concrete next steps, not generic advice).
3. A confidence score from 0 to 1 reflecting how likely this is a true positive based on the evidence.

Respond ONLY as strict JSON with keys: summary, recommendation, confidence. No markdown, no preamble.`;

function buildUserPrompt(input: TriageInput): string {
  const eventSample = input.events
    .slice(0, 10)
    .map(
      (e) =>
        `- [${e.occurredAt.toISOString()}] type=${e.eventType} source=${e.sourceIp ?? 'n/a'} user=${
          e.username ?? 'n/a'
        } host=${e.host ?? 'n/a'} msg="${e.rawMessage}"`,
    )
    .join('\n');

  return `ALERT
Title: ${input.alert.title}
Severity (rule-assigned): ${input.alert.severity}
MITRE ATT&CK: ${input.alert.mitreTechniqueId ?? 'n/a'} - ${input.alert.mitreTechniqueName ?? 'n/a'} (Tactic: ${
    input.alert.mitreTacticName ?? 'n/a'
  })
Rule description: ${input.alert.description}

UNDERLYING EVENTS (sample, up to 10):
${eventSample || 'No raw events attached.'}

Analyze this alert.`;
}

/**
 * Deterministic, dependency-free triage used whenever OPENAI_API_KEY is not
 * configured. Keeps the product fully demoable without any external calls.
 */
function mockTriage(input: TriageInput): TriageResult {
  const { alert, events } = input;
  const eventCount = events.length;

  const severityConfidence: Record<string, number> = {
    CRITICAL: 0.88,
    HIGH: 0.74,
    MEDIUM: 0.55,
    LOW: 0.35,
  };

  const summary = `${alert.title}. ${eventCount} correlated event(s) matched detection rule ${alert.ruleId}${
    alert.mitreTechniqueId ? ` (MITRE ${alert.mitreTechniqueId} — ${alert.mitreTechniqueName})` : ''
  }. Rule-based severity: ${alert.severity}.`;

  const recommendationBySeverity: Record<string, string> = {
    CRITICAL:
      'Escalate immediately. Isolate affected host(s)/account(s), force credential rotation for any implicated users, and preserve event logs for forensic review before remediation.',
    HIGH: 'Investigate within the hour. Validate whether the source IP/account is expected; if not, disable the account/block the IP and review related authentication history for the past 24h.',
    MEDIUM: 'Review during normal triage. Cross-reference the source against known scanners/allowlists; escalate only if paired with other suspicious activity.',
    LOW: 'Log for trend analysis. No immediate action required unless this pattern recurs or correlates with other alerts.',
  };

  return {
    summary,
    recommendation: recommendationBySeverity[alert.severity] ?? recommendationBySeverity.MEDIUM,
    confidence: severityConfidence[alert.severity] ?? 0.5,
    mode: 'mock',
  };
}

/**
 * Live triage via LangChain's ChatOpenAI wrapper. Only invoked when an API
 * key is configured. Falls back to mock on any error so a flaky/exhausted
 * API key never breaks the alert pipeline.
 */
async function liveTriage(input: TriageInput): Promise<TriageResult> {
  const { ChatOpenAI } = await import('@langchain/openai');
  const { HumanMessage, SystemMessage } = await import('@langchain/core/messages');

  const model = new ChatOpenAI({
    apiKey: env.OPENAI_API_KEY,
    model: env.AI_MODEL,
    temperature: 0.2,
  });

  const response = await model.invoke([
    new SystemMessage(SYSTEM_PROMPT),
    new HumanMessage(buildUserPrompt(input)),
  ]);

  const raw = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

  try {
    const parsed = JSON.parse(raw);
    return {
      summary: String(parsed.summary ?? '').trim() || 'AI analysis returned no summary.',
      recommendation: String(parsed.recommendation ?? '').trim() || 'No recommendation returned.',
      confidence: typeof parsed.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : 0.5,
      mode: 'live',
    };
  } catch (err) {
    logger.warn('Failed to parse LLM JSON response, falling back to mock', { error: (err as Error).message });
    return mockTriage(input);
  }
}

export async function triageAlert(input: TriageInput): Promise<TriageResult> {
  if (!hasAiKey) {
    return mockTriage(input);
  }

  try {
    return await liveTriage(input);
  } catch (err) {
    logger.error('Live AI triage failed, falling back to mock', { error: (err as Error).message });
    return mockTriage(input);
  }
}
