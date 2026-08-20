#!/bin/bash
# ── Kaloora Kubernetes Worker Self-Bootstrap Script ───────────────────────────
# Questo script viene eseguito da cloud-init (user_data) ad ogni avvio di istanza EC2 dall'ASG.

set -e
exec > >(tee -a /var/log/k8s-worker-bootstrap.log | logger -t user-data -s 2>/dev/console) 2>&1

echo "=========================================================================="
echo "   [Kaloora] Avvio del Bootstrap Automatico del Worker Node Kubernetes"
echo "=========================================================================="
date

export DEBIAN_FRONTEND=noninteractive
AWS_REGION="${aws_region}"
PROJECT_NAME="${project_name}"
SSM_PARAM_NAME="/$${PROJECT_NAME}/k8s/join_command"

# ── 1. Ottimizzazione Rete APT & Disabilitazione timer aggiornamenti automatici ─
echo "--> 1. Configurazione APT e disabilitazione apt-daily timers..."
echo 'Acquire::ForceIPv4 "true";' > /etc/apt/apt.conf.d/99force-ipv4
systemctl stop apt-daily.timer apt-daily-upgrade.timer || true
systemctl disable apt-daily.timer apt-daily-upgrade.timer || true
systemctl kill --kill-who=all apt-daily.service || true
systemctl kill --kill-who=all apt-daily-upgrade.service || true

# Attendi che apt sia sbloccato
while fuser /var/lib/dpkg/lock >/dev/null 2>&1 || fuser /var/lib/apt/lists/lock >/dev/null 2>&1 || fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1; do
    echo "In attesa che apt-get rilasci il lock..."
    sleep 3
done

# ── 2. Configurazione Swapfile da 2GB ──────────────────────────────────────────
echo "--> 2. Configurazione Swapfile..."
if [ ! -f /swapfile ]; then
    fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
    chmod 0600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo "/swapfile none swap sw 0 0" >> /etc/fstab
fi

# ── 3. Moduli Kernel & Parametri Sysctl ────────────────────────────────────────
echo "--> 3. Configurazione Moduli Kernel e Sysctl..."
cat << 'EOF' > /etc/modules-load.d/k8s.conf
overlay
br_netfilter
EOF

modprobe overlay
modprobe br_netfilter

cat << 'EOF' > /etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-iptables  = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.ip_forward                 = 1
vm.swappiness                       = 10
EOF

sysctl --system

# Disabilita UFW e imposta policy iptables ACCEPT per evitare blocchi tra nodi
systemctl stop ufw || true
systemctl disable ufw || true
iptables -P INPUT ACCEPT || true
iptables -P FORWARD ACCEPT || true
iptables -P OUTPUT ACCEPT || true

# ── 4. Installazione Pacchetti di Base, AWS CLI & Containerd ───────────────────
echo "--> 4. Installazione dipendenze e containerd..."
apt-get update -y
apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release containerd conntrack unzip

# Installazione/Aggiornamento AWS CLI v2 se mancante
if ! command -v aws &>/dev/null; then
    echo "Installazione AWS CLI v2..."
    curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "/tmp/awscliv2.zip"
    unzip -q /tmp/awscliv2.zip -d /tmp
    /tmp/aws/install --update || true
    rm -rf /tmp/aws /tmp/awscliv2.zip
fi

# Configurazione Containerd
mkdir -p /etc/containerd
containerd config default | sed 's/SystemdCgroup = false/SystemdCgroup = true/' > /etc/containerd/config.toml
systemctl restart containerd
systemctl enable containerd

# ── 5. Installazione Pacchetti Kubernetes v1.31 ────────────────────────────────
echo "--> 5. Installazione pacchetti Kubernetes v1.31..."
mkdir -p /etc/apt/keyrings
curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.31/deb/Release.key | gpg --yes --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg
echo "deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.31/deb/ /" > /etc/apt/sources.list.d/kubernetes.list

apt-get update -y
apt-get install -y kubelet kubeadm kubectl
apt-mark hold kubelet kubeadm kubectl

cat << 'EOF' > /etc/default/kubelet
KUBELET_EXTRA_ARGS="--fail-swap-on=false"
EOF

systemctl daemon-reload
systemctl restart kubelet
systemctl enable kubelet

# ── 6. Attesa & Recupero del Join Command da AWS SSM Parameter Store ──────────
echo "--> 6. Polling per il recupero del token di join da AWS SSM Parameter Store ($SSM_PARAM_NAME)..."

JOIN_COMMAND=""
MAX_RETRIES=120
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    JOIN_COMMAND=$(aws ssm get-parameter --name "$SSM_PARAM_NAME" --with-decryption --query "Parameter.Value" --output text --region "$AWS_REGION" 2>/dev/null || true)
    
    if [ -n "$JOIN_COMMAND" ] && [ "$JOIN_COMMAND" != "None" ] && [[ "$JOIN_COMMAND" == *"kubeadm join"* ]]; then
        echo "✅ Join command recuperato con successo da SSM!"
        break
    fi
    
    echo "In attesa che il Control Plane inizializzi il cluster e salvi il token su SSM... (Tentativo $((RETRY_COUNT+1))/$MAX_RETRIES)"
    sleep 15
    RETRY_COUNT=$((RETRY_COUNT+1))
done

if [ -z "$JOIN_COMMAND" ] || [[ "$JOIN_COMMAND" != *"kubeadm join"* ]]; then
    echo "❌ Timeout: Nessun join command valido trovato su SSM ($SSM_PARAM_NAME). Verificare lo stato del Control Plane."
    exit 1
fi

# ── 7. Join al Cluster Kubernetes con Retry Loop Resiliente ───────────────────
echo "--> 7. Esecuzione kubeadm join..."

JOIN_SUCCESS=false
JOIN_RETRIES=20
JOIN_ATTEMPT=0

while [ $JOIN_ATTEMPT -lt $JOIN_RETRIES ]; do
    echo "Tentativo di join al cluster Kubernetes ($((JOIN_ATTEMPT+1))/$JOIN_RETRIES)..."
    
    # Recupera il comando più aggiornato da SSM ad ogni tentativo per garantire l'IP corretto
    CURRENT_JOIN=$(aws ssm get-parameter --name "$SSM_PARAM_NAME" --with-decryption --query "Parameter.Value" --output text --region "$AWS_REGION" 2>/dev/null || true)
    if [ -n "$CURRENT_JOIN" ] && [[ "$CURRENT_JOIN" == *"kubeadm join"* ]]; then
        JOIN_COMMAND="$CURRENT_JOIN"
    fi

    # Esegui reset per pulire lo stato precedente se necessario
    kubeadm reset -f || true
    
    # Esegui il join tollerando swap e limiti hardware su t3.micro
    if eval "$JOIN_COMMAND --ignore-preflight-errors=NumCPU,Mem,Swap"; then
        echo "✅ kubeadm join completato con successo!"
        JOIN_SUCCESS=true
        break
    fi
    
    echo "⚠️ Join fallito temporaneamente (API Server in fase di inizializzazione o sotto carico). Nuovo tentativo tra 15s..."
    sleep 15
    JOIN_ATTEMPT=$((JOIN_ATTEMPT+1))
done

if [ "$JOIN_SUCCESS" != "true" ]; then
    echo "❌ Errore critico: Impossibile effettuare il join al cluster dopo $JOIN_RETRIES tentativi."
    exit 1
fi

echo "=========================================================================="
echo "🎉 Bootstrap completato con successo: Il nodo fa ora parte del cluster K8s!"
echo "=========================================================================="
date
