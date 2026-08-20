# ── Inventario Ansible per Cluster K8s AWS (Generato da Terraform) ─────────────
# Connessione Zero-Trust via AWS Systems Manager Session Manager (Porta 22 Chiusa)

[control_plane]
%{ for i, id in control_plane_ids ~}
control-plane-${i + 1} ansible_host=${id} ansible_user=ubuntu instance_id=${id}
%{ endfor ~}

[workers]
%{ for i, id in worker_ids ~}
worker-${i + 1} ansible_host=${id} ansible_user=ubuntu instance_id=${id}
%{ endfor ~}

[k8s:children]
control_plane
workers

[all:vars]
aws_region=${aws_region}
project_name=${project_name}
ansible_ssh_private_key_file=${ssh_private_key}
ansible_ssh_common_args=-o ProxyCommand="aws ssm start-session --target %h --document-name AWS-StartSSHSession --parameters portNumber=%p --region ${aws_region}" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=60 -o ServerAliveInterval=15 -o ServerAliveCountMax=5



