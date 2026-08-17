variable "aws_region" {
  description = "Regione AWS di destinazione per tutte le risorse"
  type        = string
  default     = "us-east-1"

  validation {
    condition     = can(regex("^[a-z]{2}-[a-z]+-[0-9]{1}$", var.aws_region))
    error_message = "aws_region deve essere un identificatore di regione AWS valido (es. us-east-1, eu-west-1)."
  }
}

variable "project_name" {
  description = "Nome del progetto usato come prefisso per le risorse"
  type        = string
  default     = "kaloora"
}

variable "environment" {
  description = "Ambiente di deploy (dev, test, prod)"
  type        = string
  default     = "test"

  validation {
    condition     = contains(["dev", "test", "prod"], var.environment)
    error_message = "environment deve essere uno tra 'dev', 'test' o 'prod'."
  }
}

# ── EC2 & Kubernetes Configuration ─────────────────────────────────────────────

variable "instance_type" {
  description = "Tipo di istanza EC2 per il cluster Kubernetes (kubeadm richiede >= 2 vCPU e 2GB RAM)"
  type        = string
  default     = "t3.medium"
}

variable "worker_count" {
  description = "Numero di nodi worker EC2 da creare"
  type        = number
  default     = 2

  validation {
    condition     = var.worker_count >= 1 && var.worker_count <= 5
    error_message = "worker_count deve essere compreso tra 1 e 5."
  }
}

variable "root_volume_size" {
  description = "Dimensione in GB del volume EBS gp3 per ciascuna istanza EC2"
  type        = number
  default     = 20

  validation {
    condition     = var.root_volume_size >= 20 && var.root_volume_size <= 100
    error_message = "root_volume_size deve essere compreso tra 20 e 100 GB."
  }
}

# ── SSH Keys ───────────────────────────────────────────────────────────────────

variable "ssh_public_key_path" {
  description = "Percorso del file della chiave SSH pubblica del progetto"
  type        = string
  default     = "id_ed25519.pub"
}

variable "ssh_private_key_path" {
  description = "Percorso del file della chiave SSH privata del progetto"
  type        = string
  default     = "id_ed25519"
}

variable "enable_ssh_ingress" {
  description = "Abilita l'apertura della porta 22 (SSH) nel Security Group. Se false, la gestione avviene esclusivamente via AWS SSM Session Manager (zero-trust)."
  type        = bool
  default     = false
}

variable "admin_ip_cidr" {
  description = "Blocco CIDR autorizzato per l'accesso SSH ai nodi EC2 se enable_ssh_ingress è true (es. proprio IP /32)"
  type        = string
  default     = ""
}

# ── Database & Secret Defaults ─────────────────────────────────────────────────

variable "db_username" {
  description = "Master username per PostgreSQL RDS"
  type        = string
  default     = "postgres"
}

variable "db_password" {
  description = "Master password per PostgreSQL RDS (se non fornita, viene generata casualmente)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "db_name" {
  description = "Nome del database iniziale PostgreSQL"
  type        = string
  default     = "userdb"
}

variable "jwt_secret" {
  description = "Chiave segreta per la firma dei token JWT (minimo 32 caratteri, se non fornita viene generata casualmente)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "redis_auth_token" {
  description = "Auth token per Redis ElastiCache (minimo 16 caratteri, se non fornito viene generato casualmente)"
  type        = string
  default     = ""
  sensitive   = true
}
