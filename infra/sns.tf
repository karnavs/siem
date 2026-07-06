resource "aws_sns_topic" "critical_alerts" {
  name = "${local.name}-critical-alerts"
  tags = { Name = "${local.name}-critical-alerts" }
}

resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.critical_alerts.arn
  protocol  = "email"
  endpoint  = var.alert_notification_email
}

output "sns_critical_alerts_topic_arn" {
  value       = aws_sns_topic.critical_alerts.arn
  description = "Set this as SNS_ALERT_TOPIC_ARN on the backend task — also referenced automatically below"
}
