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
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.public_1.id
  vpc_security_group_ids = [aws_security_group.k8s_nodes.id]
  iam_instance_profile   = aws_iam_instance_profile.k8s_node_profile.name
  key_name               = local.has_ssh_key ? aws_key_pair.kaloora_key[0].key_name : null

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 2
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

# ── 2. Worker Instances ────────────────────────────────────────────────────────

resource "aws_instance" "workers" {
  count                  = var.worker_count
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  subnet_id              = count.index % 2 == 0 ? aws_subnet.public_1.id : aws_subnet.public_2.id
  vpc_security_group_ids = [aws_security_group.k8s_nodes.id]
  iam_instance_profile   = aws_iam_instance_profile.k8s_node_profile.name
  key_name               = local.has_ssh_key ? aws_key_pair.kaloora_key[0].key_name : null

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 2
  }

  root_block_device {
    volume_size           = var.root_volume_size
    volume_type           = "gp3"
    encrypted             = true
    delete_on_termination = true
  }

  tags = {
    Name = "${var.project_name}-worker-${count.index + 1}"
    Role = "worker"
  }
}

# ── 3. Generazione Dinamica dell'Inventario Ansible (hosts.ini) ────────────────

resource "local_file" "ansible_inventory" {
  filename = "${path.module}/../ansible/hosts.ini"
  content = templatefile("${path.module}/inventory.tpl", {
    control_plane_ids = [aws_instance.control_plane.id]
    control_plane_ips = [aws_instance.control_plane.public_ip]
    worker_ids        = [for w in aws_instance.workers : w.id]
    worker_ips        = [for w in aws_instance.workers : w.public_ip]
    aws_region        = var.aws_region
    ssh_private_key   = can(regex("^/", var.ssh_private_key_path)) ? var.ssh_private_key_path : abspath("${path.module}/${var.ssh_private_key_path}")
  })
}
