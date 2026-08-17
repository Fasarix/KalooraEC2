terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    local = {
      source  = "hashicorp/local"
      version = "~> 2.5"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Configurazione Remote Backend S3 + DynamoDB State Locking
  # 1. Esegui 'terraform apply' nella cartella 'terraform/backend_setup/' per creare il bucket S3 e la tabella DynamoDB
  # 2. Scommenta e popola il blocco seguente con il nome del bucket creato:
   backend "s3" {
     bucket         = "kaloora-tf-state-vvfef7"
     key            = "cluster/terraform.tfstate"
     region         = "us-east-1"
     encrypt        = true
     dynamodb_table = "kaloora-tf-locks"
   }
}


provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# Disponibilità zone nella regione selezionata
data "aws_availability_zones" "available" {
  state = "available"
}

# AMI Ubuntu 24.04 LTS ufficiale per architettura x86_64
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# Suffix random per nomi globalmente unici (S3, ECR)
resource "random_string" "suffix" {
  length  = 6
  special = false
  upper   = false
}
