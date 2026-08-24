locals {
  ssh_pub_rel_path = var.ssh_public_key_path != "" ? (can(regex("^/", var.ssh_public_key_path)) ? var.ssh_public_key_path : "${path.module}/${var.ssh_public_key_path}") : ""
  has_ssh_key      = local.ssh_pub_rel_path != "" && fileexists(local.ssh_pub_rel_path)
}

resource "aws_key_pair" "kaloora_key" {
  count      = local.has_ssh_key ? 1 : 0
  key_name   = "${var.project_name}-ssh-key"
  public_key = trimspace(file(local.ssh_pub_rel_path))
}

# ── 1. Control Plane Instance ──────────────────────────────────────────────────

resource "aws_instance" "control_plane" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.control_plane_instance_type
  subnet_id              = aws_subnet.public_1.id
  vpc_security_group_ids = [aws_security_group.k8s_nodes.id]
  iam_instance_profile   = aws_iam_instance_profile.k8s_node_profile.name
  key_name               = local.has_ssh_key ? aws_key_pair.kaloora_key[0].key_name : null
  ebs_optimized          = true
  monitoring             = true

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 3
  }

  root_block_device {
    volume_size           = var.root_volume_size
    volume_type           = "gp3"
    encrypted             = true
    delete_on_termination = true
  }

  tags = {
    Name = "${var.project_name}-control-plane-1"
    Role = "control-plane"
  }
}

# ── 2. Worker Nodes Launch Template & Auto Scaling Group (ASG) ─────────────────

resource "aws_launch_template" "worker" {
  name_prefix   = "${var.project_name}-worker-lt-"
  image_id      = data.aws_ami.ubuntu.id
  instance_type = var.worker_instance_type
  key_name      = local.has_ssh_key ? aws_key_pair.kaloora_key[0].key_name : null
  ebs_optimized = true

  vpc_security_group_ids = [aws_security_group.k8s_nodes.id]

  iam_instance_profile {
    name = aws_iam_instance_profile.k8s_node_profile.name
  }

  monitoring {
    enabled = true
  }

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 3
  }

  block_device_mappings {
    device_name = "/dev/sda1"

    ebs {
      volume_size           = var.root_volume_size
      volume_type           = "gp3"
      encrypted             = true
      delete_on_termination = true
    }
  }

  user_data = base64encode(templatefile("${path.module}/templates/worker_bootstrap.sh.tpl", {
    aws_region   = var.aws_region
    project_name = var.project_name
  }))

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name = "${var.project_name}-worker"
      Role = "worker"
    }
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_autoscaling_group" "workers" {
  name_prefix         = "${var.project_name}-workers-asg-"
  vpc_zone_identifier = [aws_subnet.public_1.id, aws_subnet.public_2.id]
  min_size            = var.asg_min_size
  max_size            = var.asg_max_size
  desired_capacity    = var.worker_count

  # Registrazione automatica dei nodi nel Target Group dell'ALB sulla NodePort 30080
  target_group_arns = [aws_lb_target_group.k8s_ingress.arn]

  health_check_type         = "EC2"
  health_check_grace_period = 300
  force_delete              = true

  launch_template {
    id      = aws_launch_template.worker.id
    version = "$Latest"
  }

  instance_refresh {
    strategy = "Rolling"
    preferences {
      min_healthy_percentage = 50
    }
    triggers = ["tag"]
  }

  tag {
    key                 = "Name"
    value               = "${var.project_name}-worker"
    propagate_at_launch = true
  }

  tag {
    key                 = "Role"
    value               = "worker"
    propagate_at_launch = true
  }

  tag {
    key                 = "Project"
    value               = var.project_name
    propagate_at_launch = true
  }

  lifecycle {
    create_before_destroy = true
    ignore_changes        = [desired_capacity]
  }
}

# ── 3. Generazione Dinamica dell'Inventario Ansible (hosts.ini) ────────────────

resource "local_file" "ansible_inventory" {
  filename = "${path.module}/../ansible/hosts.ini"
  content = templatefile("${path.module}/inventory.tpl", {
    control_plane_ids = [aws_instance.control_plane.id]
    control_plane_ips = [aws_instance.control_plane.public_ip]
    worker_ids        = []
    worker_ips        = []
    aws_region        = var.aws_region
    project_name      = var.project_name
    ssh_private_key   = can(regex("^/", var.ssh_private_key_path)) ? var.ssh_private_key_path : abspath("${path.module}/${var.ssh_private_key_path}")
  })
}
