# ── Inventario Ansible per Cluster K8s AWS (Generato da Terraform) ─────────────
# Supporta sia la connessione Zero-Trust via AWS Systems Manager Session Manager (consigliata)
# sia la connessione SSH standard se abilitata.

[control_plane]
%{ for i, ip in control_plane_ips ~}
control-plane-${i + 1} ansible_host=${ip} ansible_user=ubuntu instance_id=${control_plane_ids[i]}
%{ endfor ~}

[workers]
%{ for i, ip in worker_ips ~}
worker-${i + 1} ansible_host=${ip} ansible_user=ubuntu instance_id=${worker_ids[i]}
%{ endfor ~}

[k8s:children]
control_plane
workers

[all:vars]
aws_region=${aws_region}
ansible_ssh_private_key_file=${ssh_private_key}
ansible_ssh_common_args=-o StrictHostKeyChecking=accept-new


