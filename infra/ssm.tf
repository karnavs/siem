# Secrets live in SSM Parameter Store (SecureString, KMS-encrypted) and are
# injected into the container at task start via the `secrets` block in the
# ECS task definition — never as plaintext `environment` values, and never
# visible in `terraform show` output to anyone without ssm:GetParameter.

resource "aws_ssm_parameter" "database_url" {
  name  = "/${local.name}/database-url"
  type  = "SecureString"
  value = "postgresql://${var.db_username}:${var.db_password}@${aws_db_instance.main.endpoint}/${var.db_name}"
}

resource "aws_ssm_parameter" "jwt_access_secret" {
  name  = "/${local.name}/jwt-access-secret"
  type  = "SecureString"
  value = var.jwt_access_secret
}

resource "aws_ssm_parameter" "jwt_refresh_secret" {
  name  = "/${local.name}/jwt-refresh-secret"
  type  = "SecureString"
  value = var.jwt_refresh_secret
}

resource "aws_ssm_parameter" "openai_api_key" {
  name  = "/${local.name}/openai-api-key"
  type  = "SecureString"
  value = var.openai_api_key != "" ? var.openai_api_key : "unset"
}

# The default execution role policy doesn't include SSM read access — grant it explicitly.
resource "aws_iam_role_policy" "ecs_execution_ssm_read" {
  name = "${local.name}-ecs-execution-ssm-read"
  role = aws_iam_role.ecs_task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid    = "ReadAppSecrets"
      Effect = "Allow"
      Action = ["ssm:GetParameters", "ssm:GetParameter"]
      Resource = [
        aws_ssm_parameter.database_url.arn,
        aws_ssm_parameter.jwt_access_secret.arn,
        aws_ssm_parameter.jwt_refresh_secret.arn,
        aws_ssm_parameter.openai_api_key.arn,
      ]
    }]
  })
}
