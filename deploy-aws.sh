#!/bin/bash
set -e

# Change directory to script location
cd "$(dirname "$0")"

echo "=========================================================================="
echo "   [Kaloora] Deploy su Cluster Kubernetes AWS EC2 + S3/CloudFront"
echo "=========================================================================="

# ── FASE 1: Recupero informazioni da Terraform ────────────────────────────────
echo "=== [1/4] Recupero parametri e credenziali da Terraform ==="
cd terraform

if [ ! -f "terraform.tfstate" ]; then
  echo "❌ Errore: file terraform.tfstate non trovato. Assicurati di aver eseguito 'terraform apply'."
  exit 1
fi

CONTROL_PLANE_ID=$(TF_CLI_CONFIG_FILE=/dev/null terraform output -raw control_plane_id 2>/dev/null || true)
CONTROL_PLANE_IP=$(TF_CLI_CONFIG_FILE=/dev/null terraform output -raw control_plane_public_ip 2>/dev/null || true)
AWS_REGION=$(TF_CLI_CONFIG_FILE=/dev/null terraform output -raw aws_region 2>/dev/null || echo "us-east-1")
S3_BUCKET=$(TF_CLI_CONFIG_FILE=/dev/null terraform output -raw s3_frontend_bucket 2>/dev/null || true)
CLOUDFRONT_URL=$(TF_CLI_CONFIG_FILE=/dev/null terraform output -raw cloudfront_domain_name 2>/dev/null || true)
CLOUDFRONT_DIST_ID=$(TF_CLI_CONFIG_FILE=/dev/null terraform output -raw cloudfront_distribution_id 2>/dev/null || true)
SSH_KEY_PATH=$(TF_CLI_CONFIG_FILE=/dev/null terraform output -raw control_plane_ssh_command 2>/dev/null | awk -F'-i ' '{print $2}' | awk '{print $1}' || echo "id_ed25519")

USER_ECR=$(TF_CLI_CONFIG_FILE=/dev/null terraform output -json ecr_repository_urls 2>/dev/null | grep -o '"user-service": "[^"]*' | cut -d'"' -f4 || true)
DIARY_ECR=$(TF_CLI_CONFIG_FILE=/dev/null terraform output -json ecr_repository_urls 2>/dev/null | grep -o '"diary-service": "[^"]*' | cut -d'"' -f4 || true)
ANALYTICS_ECR=$(TF_CLI_CONFIG_FILE=/dev/null terraform output -json ecr_repository_urls 2>/dev/null | grep -o '"analytics-service": "[^"]*' | cut -d'"' -f4 || true)

cd ..

if [ -z "$CONTROL_PLANE_ID" ] && [ -z "$CONTROL_PLANE_IP" ]; then
  echo "❌ Impossibile determinare l'istanza Control Plane. Verifica i Terraform output."
  exit 1
fi

echo "  -> Control Plane ID: ${CONTROL_PLANE_ID}"
echo "  -> Control Plane IP: ${CONTROL_PLANE_IP}"
echo "  -> AWS Region: ${AWS_REGION}"
echo "  -> S3 Frontend Bucket: ${S3_BUCKET}"
echo "  -> CloudFront URL: ${CLOUDFRONT_URL}"
echo "  -> CloudFront Dist ID: ${CLOUDFRONT_DIST_ID}"
echo "  -> ECR User Service: ${USER_ECR}"

# ── FASE 2: Deploy Frontend su AWS S3 & CloudFront ────────────────────────────
echo ""
echo "=== [2/4] Deploy del Frontend su S3 e invalidazione CDN ==="
if [ -n "$S3_BUCKET" ]; then
  echo "  -> Sincronizzazione file statici su s3://${S3_BUCKET}..."
  aws s3 sync frontend/ "s3://${S3_BUCKET}/" --exclude "Dockerfile" --exclude "nginx.conf" --delete
  echo "  ✅ Frontend caricato con successo su S3."

  if [ -n "$CLOUDFRONT_DIST_ID" ]; then
    echo "  -> Invalidazione cache CloudFront per la distribuzione ${CLOUDFRONT_DIST_ID}..."
    aws cloudfront create-invalidation --distribution-id "$CLOUDFRONT_DIST_ID" --paths "/*" >/dev/null 2>&1 || true
    echo "  ✅ Invalidazione cache CloudFront richiesta."
  fi
else
  echo "  ⚠️ S3 bucket non configurato, salto deploy frontend."
fi

# ── FASE 3: Verifica Segreti & Trasferimento Manifesti ────────────────────────
echo ""
echo "=== [3/4] Trasferimento manifesti K8s sul Control Plane ==="

# Verifica che secret.yaml sia presente o generabile
if [ ! -f "k8s/secret.yaml" ]; then
  echo "⚠️ File k8s/secret.yaml non trovato. Controllo se i secret sono presenti in AWS SSM Parameter Store..."
  JWT_CHECK=$(aws ssm get-parameter --name "/kaloora/jwt_secret" --region "$AWS_REGION" 2>/dev/null || true)
  if [ -z "$JWT_CHECK" ]; then
    echo "❌ ERRORE CRITICO: Né k8s/secret.yaml né i parametri in AWS SSM sono stati trovati."
    echo "   Esegui 'terraform apply' per generare i segreti in modo sicuro prima del deploy."
    exit 1
  fi
fi

SSH_KEY="terraform/${SSH_KEY_PATH}"
if [ ! -f "$SSH_KEY" ]; then
  SSH_KEY="terraform/id_ed25519"
fi

# Modalità di connessione (SSM Session Manager Proxy o SSH diretto)
if [ -n "$CONTROL_PLANE_ID" ] && command -v aws >/dev/null 2>&1; then
  echo "  -> Connessione tramite AWS Systems Manager (SSM)..."
  SSH_OPTS="-o ProxyCommand=\"aws ssm start-session --target ${CONTROL_PLANE_ID} --document-name AWS-StartSSHSession --parameters portNumber=%p --region ${AWS_REGION}\" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"
  if [ -f "$SSH_KEY" ]; then
    SSH_OPTS="${SSH_OPTS} -i ${SSH_KEY}"
  fi
  TARGET_HOST="ubuntu@${CONTROL_PLANE_ID}"
else
  echo "  -> Connessione tramite SSH diretto su ${CONTROL_PLANE_IP}..."
  SSH_OPTS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"
  if [ -f "$SSH_KEY" ]; then
    SSH_OPTS="${SSH_OPTS} -i ${SSH_KEY}"
  fi
  TARGET_HOST="ubuntu@${CONTROL_PLANE_IP}"
fi

eval ssh ${SSH_OPTS} "${TARGET_HOST}" "mkdir -p /home/ubuntu/k8s"
eval scp ${SSH_OPTS} -r k8s/* "${TARGET_HOST}:/home/ubuntu/k8s/"

# ── FASE 4: Applicazione dei Manifesti Kubernetes ─────────────────────────────
echo ""
echo "=== [4/4] Applicazione dei manifesti Kubernetes dei Microservizi ==="
eval ssh ${SSH_OPTS} "${TARGET_HOST}" "
  set -e
  export KUBECONFIG=/home/ubuntu/.kube/config
  
  echo '1. Applicazione Namespace, LimitRange, Quota e NetworkPolicies...'
  kubectl apply -f /home/ubuntu/k8s/namespace.yaml
  kubectl apply -f /home/ubuntu/k8s/network-policy.yaml
  
  echo '2. Applicazione Secrets...'
  if [ -f /home/ubuntu/k8s/secret.yaml ]; then
    kubectl apply -f /home/ubuntu/k8s/secret.yaml
  else
    echo '❌ k8s/secret.yaml non trovato sul Control Plane!'
    exit 1
  fi

  echo '3. Aggiornamento immagini ECR nei manifesti (se disponibili)...'
  if [ -n \"$USER_ECR\" ]; then
    sed -i \"s|image: user-service:v1.0.0|image: ${USER_ECR}:v1.0.0|g\" /home/ubuntu/k8s/user-service.yaml || true
    sed -i \"s|image: diary-service:v1.0.0|image: ${DIARY_ECR}:v1.0.0|g\" /home/ubuntu/k8s/diary-service.yaml || true
    sed -i \"s|image: analytics-service:v1.0.0|image: ${ANALYTICS_ECR}:v1.0.0|g\" /home/ubuntu/k8s/analytics-service.yaml || true
  fi
  
  echo '4. Installazione dichiarativa Ingress Nginx Controller (NodePort 30080 pre-configurata)...'
  kubectl apply -f /home/ubuntu/k8s/ingress-nginx.yaml
  kubectl delete ValidatingWebhookConfiguration ingress-nginx-admission --ignore-not-found || true

  echo '   -> Attesa readiness di Ingress Nginx Controller...'
  kubectl wait --namespace ingress-nginx \
    --for=condition=ready pod \
    --selector=app.kubernetes.io/component=controller \
    --timeout=120s || true
  
  echo '5. Applicazione Microservizi Backend, HPA/PDB e Ingress...'
  kubectl apply -f /home/ubuntu/k8s/user-service.yaml
  kubectl apply -f /home/ubuntu/k8s/diary-service.yaml
  kubectl apply -f /home/ubuntu/k8s/analytics-service.yaml
  kubectl apply -f /home/ubuntu/k8s/hpa-pdb.yaml || true
  kubectl apply -f /home/ubuntu/k8s/ingress.yaml

  echo '6. Rollout restart per caricare le nuove configurazioni...'
  kubectl rollout restart deployment user-service diary-service analytics-service -n kaloora || true
"

echo ""
echo "=========================================================================="
echo "🎉 Deployment AWS completato con successo!"
echo "=========================================================================="
echo "Accedi all'applicazione web tramite:"
echo "👉 ${CLOUDFRONT_URL}"
echo ""
