# ── Security Groups ────────────────────────────────────────────────────────────

# Security Group per i Nodi Kubernetes (Control Plane e Workers)
resource "aws_security_group" "k8s_nodes" {
  name        = "${var.project_name}-k8s-nodes-sg"
  description = "Security Group per i nodi del cluster Kubernetes su EC2"
  vpc_id      = aws_vpc.main.id

  # SSH (amministrazione remota opzionale: di default disabilitata in favore di AWS SSM Session Manager)
  dynamic "ingress" {
    for_each = var.enable_ssh_ingress && var.admin_ip_cidr != "" ? [1] : []
    content {
      description = "SSH Access from Admin CIDR"
      from_port   = 22
      to_port     = 22
      protocol    = "tcp"
      cidr_blocks = [var.admin_ip_cidr]
    }
  }

  # NodePort Ingress solo dall'Application Load Balancer (ALB)
  ingress {
    description     = "NodePort Ingress only from ALB"
    from_port       = 30000
    to_port         = 32767
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  # Comunicazione completa tra tutti i nodi e subnet della VPC (Kube API, etcd, Kubelet, Calico VXLAN/BGP)
  ingress {
    description = "All VPC intra-cluster traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = [aws_vpc.main.cidr_block]
  }

  ingress {
    description = "Inter-node self traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    self        = true
  }

  # Egress completo verso Internet (per scaricare pacchetti, container images e contattare AWS APIs)
  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-k8s-nodes-sg"
  }
}

# Security Group per RDS PostgreSQL (accetta connessioni solo dal SG dei nodi K8s)
# Zero-trust: nessuna regola di egress in uscita verso l'esterno
resource "aws_security_group" "rds" {
  name        = "${var.project_name}-rds-sg"
  description = "Security Group per RDS PostgreSQL"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "PostgreSQL from K8s nodes"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.k8s_nodes.id]
  }

  tags = {
    Name = "${var.project_name}-rds-sg"
  }
}

# Security Group per ElastiCache Redis (accetta connessioni solo dal SG dei nodi K8s)
# Zero-trust: nessuna regola di egress in uscita verso l'esterno
resource "aws_security_group" "elasticache" {
  name        = "${var.project_name}-elasticache-sg"
  description = "Security Group per ElastiCache Redis"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Redis from K8s nodes"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.k8s_nodes.id]
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-elasticache-sg"
  }
}
