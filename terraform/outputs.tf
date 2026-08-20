# ── Terraform Outputs ──────────────────────────────────────────────────────────

# ── EC2 & K8s Cluster ──────────────────────────────────────────────────────────

output "control_plane_id" {
  description = "ID dell'istanza EC2 del Control Plane per AWS SSM"
  value       = aws_instance.control_plane.id
}

output "control_plane_public_ip" {
  description = "IP pubblico del Control Plane Kubernetes su EC2"
  value       = aws_instance.control_plane.public_ip
}

output "control_plane_ssh_command" {
  description = "Comando per accedere via SSH al Control Plane (se abilitato)"
  value       = "ssh -i ${var.ssh_private_key_path} ubuntu@${aws_instance.control_plane.public_ip}"
}

output "control_plane_ssm_session_command" {
  description = "Comando AWS SSM Session Manager per accedere al Control Plane in modo sicuro senza porte aperte"
  value       = "aws ssm start-session --target ${aws_instance.control_plane.id} --region ${var.aws_region}"
}

output "asg_name" {
  description = "Nome dell'Auto Scaling Group dei nodi Worker"
  value       = aws_autoscaling_group.workers.name
}

output "asg_arn" {
  description = "ARN dell'Auto Scaling Group dei nodi Worker"
  value       = aws_autoscaling_group.workers.arn
}

output "launch_template_id" {
  description = "ID del Launch Template per i nodi Worker"
  value       = aws_launch_template.worker.id
}

output "launch_template_latest_version" {
  description = "Ultima versione del Launch Template per i nodi Worker"
  value       = aws_launch_template.worker.latest_version
}

# ── AWS Application Load Balancer (ALB) ────────────────────────────────────────

output "alb_dns_name" {
  description = "DNS pubblico dell'AWS Application Load Balancer"
  value       = aws_lb.main.dns_name
}

# ── Databases & Messaging ──────────────────────────────────────────────────────

output "rds_postgres_endpoint" {
  description = "Endpoint di connessione a RDS PostgreSQL"
  value       = aws_db_instance.postgres.endpoint
}

output "rds_postgres_address" {
  description = "Host di connessione a RDS PostgreSQL"
  value       = aws_db_instance.postgres.address
}

output "dynamodb_diary_table" {
  description = "Nome tabella DynamoDB per il diario pasti"
  value       = aws_dynamodb_table.diary.name
}

output "dynamodb_foods_table" {
  description = "Nome tabella DynamoDB per gli alimenti e ricette"
  value       = aws_dynamodb_table.foods.name
}

output "sqs_queue_url" {
  description = "URL della coda Amazon SQS per gli eventi diario"
  value       = aws_sqs_queue.diary_events.url
}

output "elasticache_redis_endpoint" {
  description = "Endpoint host di ElastiCache Redis"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
}

# ── Frontend & CloudFront ──────────────────────────────────────────────────────

output "s3_frontend_bucket" {
  description = "Nome del bucket S3 per il deploy del frontend"
  value       = aws_s3_bucket.frontend.id
}

output "cloudfront_domain_name" {
  description = "URL pubblico CloudFront per accedere alla WebApp Kaloora"
  value       = "https://${aws_cloudfront_distribution.frontend.domain_name}"
}

output "cloudfront_distribution_id" {
  description = "ID della distribuzione CloudFront per invalidazione cache"
  value       = aws_cloudfront_distribution.frontend.id
}

# ── ECR Repositories ───────────────────────────────────────────────────────────

output "ecr_repository_urls" {
  description = "URL dei repository ECR per i container"
  value       = { for k, v in aws_ecr_repository.services : k => v.repository_url }
}
