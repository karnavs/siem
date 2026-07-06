variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "ap-south-1"
}

variable "environment" {
  description = "Environment name (e.g. production, staging)"
  type        = string
  default     = "production"
}

variable "project_name" {
  description = "Short name used as a prefix for resource names"
  type        = string
  default     = "sentrygrid"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.42.0.0/16"
}

variable "availability_zones" {
  description = "AZs to spread subnets across (2 is enough for an ALB + RDS multi-AZ-capable setup)"
  type        = list(string)
  default     = ["ap-south-1a", "ap-south-1b"]
}

variable "db_name" {
  description = "Postgres database name"
  type        = string
  default     = "sentrygrid"
}

variable "db_username" {
  description = "Postgres master username"
  type        = string
  default     = "sentrygrid"
  sensitive   = true
}

variable "db_password" {
  description = "Postgres master password — pass via TF_VAR_db_password or a tfvars file that is gitignored. Never commit this."
  type        = string
  sensitive   = true
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t4g.micro" # cheapest reasonable option; bump for real production load
}

variable "jwt_access_secret" {
  description = "Secret used to sign JWT access tokens — generate with `openssl rand -hex 32`"
  type        = string
  sensitive   = true
}

variable "jwt_refresh_secret" {
  description = "Secret used to sign JWT refresh tokens — generate with `openssl rand -hex 32`"
  type        = string
  sensitive   = true
}

variable "openai_api_key" {
  description = "OpenAI API key for live AI triage. Leave empty to run in mock mode."
  type        = string
  sensitive   = true
  default     = ""
}

variable "alert_notification_email" {
  description = "Email address subscribed to the critical-alert SNS topic"
  type        = string
}

variable "backend_image_tag" {
  description = "Tag of the backend image to deploy (set by CI/CD to the git SHA)"
  type        = string
  default     = "latest"
}

variable "frontend_image_tag" {
  description = "Tag of the frontend image to deploy (set by CI/CD to the git SHA)"
  type        = string
  default     = "latest"
}

variable "backend_desired_count" {
  description = "Number of backend ECS tasks to run"
  type        = number
  default     = 1
}

variable "frontend_desired_count" {
  description = "Number of frontend ECS tasks to run"
  type        = number
  default     = 1
}

variable "enable_bastion" {
  description = "Whether to provision the bastion EC2 instance for direct RDS access"
  type        = bool
  default     = true
}

variable "bastion_allowed_ssh_cidr" {
  description = "CIDR allowed to SSH into the bastion — set this to YOUR IP/32, never 0.0.0.0/0"
  type        = string
}

variable "bastion_key_pair_name" {
  description = "Name of an existing EC2 key pair for bastion SSH access"
  type        = string
}

variable "github_org_repo" {
  description = "GitHub \"org/repo\" allowed to assume the CI/CD IAM role via OIDC, e.g. \"karna/sentrygrid\""
  type        = string
}
