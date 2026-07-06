output "ecr_backend_repository_url" {
  value = aws_ecr_repository.backend.repository_url
}

output "ecr_frontend_repository_url" {
  value = aws_ecr_repository.frontend.repository_url
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "rds_endpoint" {
  value       = aws_db_instance.main.endpoint
  description = "Use via the bastion (psql) for initial migration setup — never expose this publicly"
  sensitive   = true
}

output "app_url" {
  value       = "http://${aws_lb.main.dns_name}"
  description = "Where the app is reachable once both ECS services are healthy"
}
