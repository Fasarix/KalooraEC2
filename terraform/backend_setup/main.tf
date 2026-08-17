# Backend S3 + DynamoDB State Locking Bootstrap
terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "project_name" {
  type    = string
  default = "kaloora"
}

resource "random_string" "state_suffix" {
  length  = 6
  special = false
  upper   = false
}

# S3 Bucket per il Terraform State remoto cifrato
resource "aws_s3_bucket" "tf_state" {
  bucket        = "${var.project_name}-tf-state-${random_string.state_suffix.result}"
  force_destroy = false

  tags = {
    Name        = "${var.project_name}-tf-state"
    Environment = "management"
  }
}

resource "aws_s3_bucket_versioning" "tf_state_versioning" {
  bucket = aws_s3_bucket.tf_state.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "tf_state_encryption" {
  bucket = aws_s3_bucket.tf_state.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "tf_state_access" {
  bucket                  = aws_s3_bucket.tf_state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# DynamoDB Table per il State Locking concorrente
resource "aws_dynamodb_table" "tf_locks" {
  name         = "${var.project_name}-tf-locks"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  tags = {
    Name        = "${var.project_name}-tf-locks"
    Environment = "management"
  }
}

output "s3_bucket_name" {
  value = aws_s3_bucket.tf_state.id
}

output "dynamodb_table_name" {
  value = aws_dynamodb_table.tf_locks.name
}

output "backend_config_instruction" {
  value = <<-EOT
    Aggiungi al blocco backend in terraform/main.tf:
    backend "s3" {
      bucket         = "${aws_s3_bucket.tf_state.id}"
      key            = "cluster/terraform.tfstate"
      region         = "${var.aws_region}"
      encrypt        = true
      dynamodb_table = "${aws_dynamodb_table.tf_locks.name}"
    }
  EOT
}
