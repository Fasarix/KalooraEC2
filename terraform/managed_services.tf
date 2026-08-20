resource "random_password" "generated_jwt_secret" {
  length  = 36
  special = false
}

resource "random_password" "generated_db_password" {
  length           = 20
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "random_password" "generated_redis_auth_token" {
  length  = 32
  special = false
}

resource "random_password" "generated_origin_verify_secret" {
  length  = 32
  special = false
}

locals {
  services             = ["user-service", "diary-service", "analytics-service"]
  jwt_secret           = var.jwt_secret != "" ? var.jwt_secret : random_password.generated_jwt_secret.result
  db_password          = var.db_password != "" ? var.db_password : random_password.generated_db_password.result
  redis_auth_token     = var.redis_auth_token != "" ? var.redis_auth_token : random_password.generated_redis_auth_token.result
  origin_verify_secret = random_password.generated_origin_verify_secret.result
}

# ── 1. RDS PostgreSQL (user-service) ──────────────────────────────────────────

resource "aws_db_subnet_group" "rds" {
  name       = "${var.project_name}-rds-subnet-group"
  subnet_ids = [aws_subnet.private_1.id, aws_subnet.private_2.id]

  tags = {
    Name = "${var.project_name}-rds-subnet-group"
  }
}

# Parameter Group per imporre la crittografia in-transit (SSL/TLS forzato)
resource "aws_db_parameter_group" "postgres" {
  name   = "${var.project_name}-pg15-params"
  family = "postgres15"

  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }

  tags = {
    Name = "${var.project_name}-pg15-params"
  }
}

resource "aws_db_instance" "postgres" {
  identifier                 = "${var.project_name}-postgres-db"
  allocated_storage          = 20
  max_allocated_storage      = 20
  storage_type               = "gp3"
  storage_encrypted          = true # Encryption at-rest (KMS)
  engine                     = "postgres"
  engine_version             = "15"
  instance_class             = "db.t3.micro"
  db_name                    = var.db_name
  username                   = var.db_username
  password                   = local.db_password
  db_subnet_group_name       = aws_db_subnet_group.rds.name
  parameter_group_name       = aws_db_parameter_group.postgres.name
  vpc_security_group_ids     = [aws_security_group.rds.id]
  publicly_accessible        = false
  backup_retention_period    = 0 # Disabilitato per conformita con le restrizioni Free Tier
  auto_minor_version_upgrade = true
  copy_tags_to_snapshot      = true
  skip_final_snapshot        = true
  deletion_protection        = false

  tags = {
    Name = "${var.project_name}-postgres-db"
  }
}

# ── 2. Amazon DynamoDB (diary-service) ────────────────────────────────────────

resource "aws_dynamodb_table" "diary" {
  name                        = "${var.project_name}-diary"
  billing_mode                = "PAY_PER_REQUEST"
  hash_key                    = "userId"
  range_key                   = "date"
  deletion_protection_enabled = false

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "date"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name = "${var.project_name}-diary-table"
  }
}

resource "aws_dynamodb_table" "foods" {
  name                        = "${var.project_name}-foods"
  billing_mode                = "PAY_PER_REQUEST"
  hash_key                    = "name"
  deletion_protection_enabled = false

  attribute {
    name = "name"
    type = "S"
  }

  attribute {
    name = "category"
    type = "S"
  }

  # Global Secondary Index per ricerche veloci per categoria e filtraggio ricette
  global_secondary_index {
    name            = "CategoryIndex"
    hash_key        = "category"
    range_key       = "name"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name = "${var.project_name}-foods-table"
  }
}


# ── 3. Amazon SQS (Disaccoppiamento Eventi) ────────────────────────────────────

resource "aws_sqs_queue" "diary_dlq" {
  name                      = "${var.project_name}-diary-dlq"
  message_retention_seconds = 86400 # 1 giorno per test
  sqs_managed_sse_enabled   = true  # Encryption at-rest

  tags = {
    Name = "${var.project_name}-diary-dlq"
  }
}

resource "aws_sqs_queue" "diary_events" {
  name                      = "${var.project_name}-diary-events"
  message_retention_seconds = 86400
  receive_wait_time_seconds = 20   # Long polling
  sqs_managed_sse_enabled   = true # Encryption at-rest

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.diary_dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Name = "${var.project_name}-diary-events"
  }
}

# ── 4. Amazon ElastiCache Redis (analytics-service) ───────────────────────────
# Usiamo Replication Group per abilitare transit encryption e at-rest encryption

resource "aws_elasticache_subnet_group" "redis" {
  name       = "${var.project_name}-redis-subnet-group"
  subnet_ids = [aws_subnet.private_1.id, aws_subnet.private_2.id]
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id       = "${var.project_name}-redis"
  description                = "ElastiCache Redis cluster for Kaloora Analytics with full encryption"
  node_type                  = "cache.t3.micro"
  num_cache_clusters         = 1
  port                       = 6379
  parameter_group_name       = "default.redis7"
  subnet_group_name          = aws_elasticache_subnet_group.redis.name
  security_group_ids         = [aws_security_group.elasticache.id]
  at_rest_encryption_enabled = true                   # Encryption at-rest
  transit_encryption_enabled = true                   # Encryption in-transit (TLS)
  auth_token                 = local.redis_auth_token # Dedicated Redis AUTH token
  auto_minor_version_upgrade = true
  apply_immediately          = true
  snapshot_retention_limit   = 0

  tags = {
    Name = "${var.project_name}-redis-cache"
  }
}

# ── 5. Amazon ECR (Registries Immagini Microservizi) ───────────────────────────

resource "aws_ecr_repository" "services" {
  for_each     = toset(local.services)
  name         = "${var.project_name}/${each.key}"
  force_delete = true

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name = "${var.project_name}-${each.key}-repo"
  }
}

# Lifecycle Policy per evitare accumulo di immagini e costi storage
resource "aws_ecr_lifecycle_policy" "services" {
  for_each   = toset(local.services)
  repository = aws_ecr_repository.services[each.key].name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Rimuovi immagini non taggate dopo 14 giorni"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 14
        }
        action = {
          type = "expire"
        }
      },
      {
        rulePriority = 2
        description  = "Conserva solo le ultime 10 immagini taggate"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 10
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# ── 6. AWS SSM Parameter Store (Secrets Centralizzati) ─────────────────────────

resource "aws_ssm_parameter" "jwt_secret" {
  name        = "/${var.project_name}/jwt_secret"
  description = "JWT Signing Secret"
  type        = "SecureString"
  value       = local.jwt_secret
  overwrite   = true
}

resource "aws_ssm_parameter" "db_password" {
  name        = "/${var.project_name}/db_password"
  description = "Master DB Password"
  type        = "SecureString"
  value       = local.db_password
  overwrite   = true
}

resource "aws_ssm_parameter" "redis_auth_token" {
  name        = "/${var.project_name}/redis_auth_token"
  description = "Redis ElastiCache Auth Token"
  type        = "SecureString"
  value       = local.redis_auth_token
  overwrite   = true
}

resource "aws_ssm_parameter" "postgres_host" {
  name        = "/${var.project_name}/postgres_host"
  description = "PostgreSQL RDS Host Endpoint"
  type        = "String"
  value       = aws_db_instance.postgres.address
  overwrite   = true
}

resource "aws_ssm_parameter" "redis_host" {
  name        = "/${var.project_name}/redis_host"
  description = "Redis ElastiCache Primary Endpoint"
  type        = "String"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
  overwrite   = true
}

resource "aws_ssm_parameter" "sqs_queue_url" {
  name        = "/${var.project_name}/sqs_queue_url"
  description = "Amazon SQS Diary Events Queue URL"
  type        = "String"
  value       = aws_sqs_queue.diary_events.url
  overwrite   = true
}

# ── 7. Generazione Automatica di k8s/secret.yaml con gli endpoint live ─────────

resource "local_file" "k8s_secret" {
  filename = "${path.module}/../k8s/secret.yaml"
  content  = <<-EOT
apiVersion: v1
kind: Secret
metadata:
  name: kaloora-secrets
  namespace: kaloora
type: Opaque
stringData:
  jwt-secret: "${local.jwt_secret}"
  postgres-host: "${aws_db_instance.postgres.address}"
  postgres-user: "${var.db_username}"
  postgres-password: "${local.db_password}"
  postgres-db: "${var.db_name}"
  redis-host: "${aws_elasticache_replication_group.redis.primary_endpoint_address}"
  redis-auth-token: "${local.redis_auth_token}"
  sqs-queue-url: "${aws_sqs_queue.diary_events.url}"
  aws-region: "${var.aws_region}"
  dynamodb-diary-table: "${aws_dynamodb_table.diary.name}"
  dynamodb-foods-table: "${aws_dynamodb_table.foods.name}"
EOT
}
