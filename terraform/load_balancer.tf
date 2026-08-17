# ── AWS Application Load Balancer (ALB) ───────────────────────────────────────

# Security Group dedicato per l'Application Load Balancer
resource "aws_security_group" "alb" {
  name        = "${var.project_name}-alb-sg"
  description = "Security Group per l'Application Load Balancer pubblico"
  vpc_id      = aws_vpc.main.id

  # Ingress HTTP da Internet / CloudFront
  ingress {
    description = "HTTP from Internet and CloudFront"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Ingress HTTPS da Internet / CloudFront
  ingress {
    description = "HTTPS from Internet and CloudFront"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Egress verso i nodi del cluster K8s
  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-alb-sg"
  }
}

# ── 1. Application Load Balancer (Multi-AZ) ───────────────────────────────────

resource "aws_lb" "main" {
  name               = "${var.project_name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = [aws_subnet.public_1.id, aws_subnet.public_2.id]

  enable_deletion_protection = false

  tags = {
    Name = "${var.project_name}-alb"
  }
}

# ── 2. Target Group verso i nodi Worker Kubernetes (Porta NodePort 30080) ──────

resource "aws_lb_target_group" "k8s_ingress" {
  name        = "${var.project_name}-k8s-tg"
  port        = 30080
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "instance"

  health_check {
    enabled             = true
    path                = "/healthz"
    port                = "30080"
    protocol            = "HTTP"
    interval            = 15
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
    matcher             = "200" # Endpoint nativo /healthz di Ingress Nginx risponde 200 OK
  }

  tags = {
    Name = "${var.project_name}-k8s-tg"
  }
}

# ── 3. Registrazione di TUTTI i nodi Worker nel Target Group ──────────────────

resource "aws_lb_target_group_attachment" "workers" {
  count            = var.worker_count
  target_group_arn = aws_lb_target_group.k8s_ingress.arn
  target_id        = aws_instance.workers[count.index].id
  port             = 30080
}

# ── 4. Listener HTTP sull'ALB con Protezione Perimetrale X-Origin-Verify ───────

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  # Blocca l'accesso diretto via IP o DNS dell'ALB (bypassing CloudFront CDN)
  default_action {
    type = "fixed-response"

    fixed_response {
      content_type = "text/plain"
      message_body = "Access Denied: Direct ALB access is forbidden. Please access via CloudFront CDN."
      status_code  = "403"
    }
  }
}

# Regola che instrada verso il target group K8s solo le richieste provenienti da CloudFront
resource "aws_lb_listener_rule" "allow_cloudfront" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.k8s_ingress.arn
  }

  condition {
    http_header {
      http_header_name = "X-Origin-Verify"
      values           = [local.origin_verify_secret]
    }
  }
}
