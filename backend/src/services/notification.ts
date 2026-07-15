import { env } from '../config/env';
import { logger } from '../utils/logger';
import { Alert } from '../db/schema';

/**
 * Publishes a notification to the configured SNS topic when a CRITICAL alert
 * fires (e.g. fans out to email/SMS subscribers — see infra/sns.tf).
 * No-ops cleanly if SNS_ALERT_TOPIC_ARN isn't configured (e.g. local dev),
 * so this never blocks the request pipeline.
 */
export async function notifyCriticalAlert(alert: Alert): Promise<void> {
  if (!env.SNS_ALERT_TOPIC_ARN) {
    logger.debug('SNS topic not configured, skipping notification', { alertId: alert.id });
    return;
  }

  try {
    // Lazy import: keeps the AWS SDK out of the bundle/startup path for
    // local dev and test runs where it's never invoked.
    const { SNSClient, PublishCommand } = await import('@aws-sdk/client-sns');
    const client = new SNSClient({ region: env.AWS_REGION });

    await client.send(
      new PublishCommand({
        TopicArn: env.SNS_ALERT_TOPIC_ARN,
        Subject: `[SentryGrid] CRITICAL: ${alert.title}`,
        Message: [
          `Severity: ${alert.severity}`,
          `Rule: ${alert.ruleId}`,
          alert.mitreTechniqueId ? `MITRE: ${alert.mitreTechniqueId} - ${alert.mitreTechniqueName}` : '',
          '',
          alert.description,
          '',
          `Alert ID: ${alert.id}`,
        ]
          .filter(Boolean)
          .join('\n'),
      }),
    );

    logger.info('Published critical alert to SNS', { alertId: alert.id });
  } catch (err) {
    // Notification failures must never break alert creation — log and move on.
    logger.error('Failed to publish SNS notification', { alertId: alert.id, error: (err as Error).message });
  }
}
