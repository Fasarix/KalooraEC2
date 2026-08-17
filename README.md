# 🥗 Kaloora — Cloud-Native Nutrition & Fitness Tracker su AWS

**Kaloora** è una piattaforma web distribuita per il tracciamento calorico, nutrizionale e delle attività fisiche. L'architettura è interamente migrata e ottimizzata per **Amazon Web Services (AWS)** seguendo i moderni paradigmi di **Microservizi Disaccoppiati**, **Event-Driven Architecture (EDA)**, **Managed/Serverless Services**, **Infrastructure as Code (Terraform)** e **DevSecOps (CI/CD)**.

---

## 📸 Schemi Architetturali

```
[ Utente / Browser ]
        │
        ▼
[ Amazon CloudFront CDN ] (PriceClass_100, OAC, Security Headers)
   ├── /*         ──► [ Amazon S3 Bucket ] (Frontend SPA Statico: HTML5/CSS3/Vanilla JS)
   └── /api/*     ──► [ AWS Application Load Balancer (ALB) ]
                            │ (Port 80 -> NodePort 30080)
                            ▼
           [ Kubernetes Cluster su EC2 (Ubuntu 24.04 + Calico CNI) ]
           ┌─────────────────────────────────────────────────────────┐
           │  • Ingress Nginx Controller (NodePort: 30080)           │
           │  • User Service (Node.js/Express, 2 Repliche, HPA)      │
           │  • Diary Service (Python/Flask/Gunicorn, 2 Repliche, HPA)│
           │  • Analytics Service (Node.js/Express, 2 Repliche, HPA) │
           │  • Calico CNI (NetworkPolicy Enforcement L3/L4)         │
           └─────────────────────────────────────────────────────────┘
                    │                │                     │
                    ▼                ▼                     ▼
             [ Amazon RDS ]   [ Amazon DynamoDB ]   [ Amazon SQS + DLQ ]
             (PostgreSQL 15)  (Pay-Per-Request)      (Event-Driven Bus)
             (Encrypted gp3)  (Diari & Alimenti)           │
                                                           ▼
                                                 [ Amazon ElastiCache ]
                                                 (Redis 7 In-Memory Cache)
```

---

## 🏛️ Architettura dei Componenti & Servizi AWS

| Modulo / Servizio | Tecnologia | Servizio AWS / Hosting | Responsabilità & Dettagli |
| :--- | :--- | :--- | :--- |
| **Frontend SPA** | HTML5, CSS3 Glassmorphism, JS ES6+ | **Amazon S3 + CloudFront CDN** | Hosting statico privato con OAC, fallback SPA su `/index.html`, HTTP Security Headers, caching edge a bassa latenza. |
| **Reverse Proxy / Gateway** | AWS ALB + Ingress Nginx | **Application Load Balancer** | Instradamento centralizzato del traffico `/api/*` verso il target group dei worker K8s sulla NodePort `30080`. |
| **User Service** | Node.js 20, Express, pg | **Kubernetes su EC2 + Amazon RDS** | Autenticazione JWT, profilo utente, calcolo BMR/TDEE con formula Mifflin-St Jeor; persistenza su **PostgreSQL 15 (RDS)** con encryption at-rest (KMS) e in-transit forzata (`rds.force_ssl=1`). |
| **Diary Service** | Python 3.11, Flask, boto3 | **Kubernetes su EC2 + Amazon DynamoDB** | Gestione diario giornaliero, pasti, idratazione, ricette e alimenti con validazione input; persistenza NoSQL su **DynamoDB** (Pay-Per-Request + PITR) e pubblicazione eventi su **Amazon SQS**. |
| **Analytics Service** | Node.js 20, Express, @aws-sdk | **Kubernetes su EC2 + ElastiCache** | Consumer SQS con long polling ed exponential backoff, calcolo trend nutrizionali settimanali/mensili e caching protetto su **ElastiCache Redis 7 Replication Group** (TLS in-transit + KMS at-rest). |
| **Event Bus & DLQ** | AWS SQS | **Amazon SQS + Dead Letter Queue** | Disaccoppiamento asincrono affidabile degli eventi applicativi con crittografia at-rest gestita (SSE-SQS). |
| **Secrets & Config** | SSM Parameter Store | **AWS Systems Manager** | Archiviazione cifrata dei segreti applicativi (`SecureString`) e generazione dinamica del secret K8s. |
| **Container Registry** | Docker Multi-Stage | **Amazon ECR** | Repository con scansione automatica delle vulnerabilità e **Lifecycle Policy** (conservazione max 10 immagini / scadenza untagged). |
| **Monitoring & Alarms** | CloudWatch Metrics | **Amazon CloudWatch** | Monitoraggio proattivo e allarmi su CPU EC2, metriche RDS e codici 5XX sull'ALB. |

---

## 📂 Struttura del Repository

```
KalooraAWS/
├── .github/workflows/        # Pipeline CI/CD GitHub Actions (DevSecOps + Build + Deploy)
│   └── deploy.yml            # Workflow con scansioni SAST (Gitleaks, Semgrep, Checkov)
├── ansible/                  # Automazione del cluster Kubernetes con Ansible
│   ├── 00-prerequisites.yml  # Configurazione Kernel, containerd e pacchetti K8s
│   ├── 01-control-plane.yml  # Inizializzazione kubeadm, Calico CNI e join token
│   ├── 02-workers.yml        # Join dei nodi worker e labeling ruoli
│   ├── ansible.cfg           # Configurazione Ansible
│   ├── hosts.ini.example     # Esempio di inventario
│   └── site.yml              # Playbook principale sequenziale
├── docs/                     # Documentazione tecnica
│   ├── eks_vs_ec2_comparison.md # Analisi comparativa EKS vs EC2 Self-Managed
│   └── openapi.yaml          # Specifica OpenAPI 3.0 dei microservizi REST
├── frontend/                 # Single Page Application Frontend
│   ├── css/                  # Design System Glassmorphism e Dark Mode
│   ├── js/                   # Logica applicativa, client API, routing
│   └── index.html            # Entrypoint WebApp
├── k8s/                      # Manifesti Kubernetes Cloud-Native
│   ├── namespace.yaml        # Namespace 'kaloora'
│   ├── secret.yaml.example   # Template dei segreti di connessione
│   ├── ingress-nginx.yaml    # Ingress Nginx Controller v1.10.0 con NodePort 30080 dichiarativo
│   ├── network-policy.yaml   # Politiche di isolamento della rete (Calico)
│   ├── user-service.yaml     # Deployment & Service (NodePort/ClusterIP)
│   ├── diary-service.yaml    # Deployment & Service (NodePort/ClusterIP)
│   ├── analytics-service.yaml# Deployment & Service (NodePort/ClusterIP)
│   ├── hpa-pdb.yaml          # Horizontal Pod Autoscaler & PodDisruptionBudget
│   └── ingress.yaml          # Regole di routing Ingress Nginx per l'ALB
├── services/                 # Microservizi Backend
│   ├── analytics-service/    # Analytics & SQS Consumer (Node.js/Express)
│   ├── diary-service/        # Diario, Ricette con GSI/Redis & DynamoDB/SQS (Python/Flask)
│   └── user-service/         # Autenticazione & RDS PostgreSQL (Node.js/Express)
├── terraform/                # Infrastruttura come Codice (AWS Provider)
│   ├── backend_setup/        # Modulo bootstrap per Bucket S3 Remote State & DynamoDB Lock Table
│   ├── main.tf               # Providers, Data sources, Remote Backend S3 + DynamoDB Lock
│   ├── vpc.tf                # VPC, Subnet pubbliche e private (Multi-AZ) e Gateway Endpoints
│   ├── security_groups.tf    # Security Groups con regole restrittive (ALB, Nodi, RDS, Redis)
│   ├── ec2_instances.tf      # EC2 Control Plane & Workers con IMDSv2 hop limit = 2
│   ├── iam.tf                # IAM Roles & Instance Profiles (SSM, DynamoDB, SQS, ECR)
│   ├── load_balancer.tf      # Application Load Balancer & Target Group (NodePort 30080)
│   ├── managed_services.tf   # RDS Postgres, DynamoDB (con GSI), SQS, ElastiCache, ECR, SSM
│   ├── frontend_cdn.tf       # Bucket S3, CloudFront OAC e Security Headers
│   ├── cloudwatch.tf         # Allarmi CloudWatch per EC2, RDS e ALB
│   ├── variables.tf          # Parametrizzazione ambiente, opzioni SSH/SSM e credenziali
│   ├── outputs.tf            # Endpoint, URI e comandi di connessione AWS SSM Session Manager

│   ├── dev.tfvars            # Profilo di dimensionamento economico/dev (t3.medium, 2 worker)
│   └── prod.tfvars           # Profilo di dimensionamento produzione (t3.large, 3 worker)
├── deploy-aws.sh             # Script di deploy applicativo end-to-end su AWS
├── LICENSE                   # Licenza MIT
└── README.md                 # Documentazione del progetto
```

---

## 🛠️ Prerequisiti

- **AWS CLI v2** configurata con credenziali dotate di permessi IAM adeguati (`aws configure`).
- **Terraform** (>= 1.5.0).
- **Ansible** (>= 2.12).
- **SSH Key Pair** (generata di default in `terraform/id_ed25519` o personalizzata).
- **kubectl** installato localmente (opzionale per amministrazione remota).

---

## 🚀 Guida al Deployment su AWS (IaC & Automazione)

Il deployment dell'infrastruttura e dei microservizi si articola in **3 fasi automatizzate**:

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   1. TERRAFORM  │ ────► │   2. ANSIBLE    │ ────► │ 3. DEPLOY-AWS   │
│ (Provisioning   │       │ (Setup K8s &    │       │ (Deploy Frontend│
│  Risorse AWS)   │       │  Calico CNI)    │       │  & Microservizi)│
└─────────────────┘       └─────────────────┘       └─────────────────┘
```

---

### Passo 1: Provisioning dell'Infrastruttura con Terraform

1. Spostati nella cartella `terraform/`:
   ```bash
   cd terraform
   terraform init
   ```

2. Genera una chiave SSH per l'accesso ai nodi (se non già presente):
   ```bash
   ssh-keygen -t ed25519 -f id_ed25519 -N ""
   ```

3. Esegui il deployment delle risorse su AWS:
   ```bash
   terraform apply -var-file="dev.tfvars" -auto-approve
   ```

*Terraform creerà la VPC, le subnet Multi-AZ, i Security Group, le istanze EC2 con IMDSv2, i ruoli IAM, l'ALB, RDS PostgreSQL cifrato, DynamoDB on-demand, SQS con DLQ, ElastiCache Redis, S3, CloudFront OAC e genererà automaticamente `ansible/hosts.ini` e `k8s/secret.yaml`.*

---

### Passo 2: Configurazione del Cluster Kubernetes con Ansible

Dalla radice del progetto, esegui i playbook Ansible:

```bash
cd ..
ansible-playbook -i ansible/hosts.ini ansible/site.yml
```

#### Cosa fa Ansible:
1. **`00-prerequisites.yml`**: Configura parametri kernel sysctl (`net.bridge.bridge-nf-call-iptables`), disabilita swap, installa **containerd** e la suite Kubernetes (**v1.31**).
2. **`01-control-plane.yml`**: Inizializza il Control Plane con `kubeadm init` sull'IP privato VPC, configura `admin.conf` e distribuisce **Calico CNI** per abilitare le NetworkPolicies.
3. **`02-workers.yml`**: Esegue il join automatico dei nodi worker via IP privato ed applica le label dei ruoli.

---

### Passo 3: Deployment dei Microservizi e Frontend (`deploy-aws.sh`)

Esegui lo script orchestratore di deployment:

```bash
./deploy-aws.sh
```

#### Fasi eseguite dallo script:
1. **Recupero Endpoint**: Estrae gli output da Terraform (IP Control Plane, Bucket S3, CloudFront URL/DistID).
2. **Deploy Frontend**: Sincronizza i file statici su S3 e richiede l'invalidazione della cache CloudFront.
3. **Deploy K8s**: Trasferisce i manifesti sul Control Plane ed applica Namespace, Secrets, NetworkPolicies, Ingress Nginx (con patch fissa su NodePort `30080`), User Service, Diary Service, Analytics Service e regole HPA/PDB.

Al termine del deployment, l'applicazione sarà accessibile all'URL pubblico di CloudFront:
```
👉 https://dxxxxxxxxxxxx.cloudfront.net
```

---

## 🛡️ Sicurezza & Conformità DevSecOps

- **Crittografia Completa (At-Rest & In-Transit)**:
  - **RDS PostgreSQL**: Storage cifrato via AWS KMS (`gp3 20GB`), in-transit forzato tramite Parameter Group (`rds.force_ssl = 1`) e connessione pool `pg` con SSL/TLS.
  - **ElastiCache Redis**: Gestito tramite Replication Group con crittografia at-rest KMS, crittografia in-transit (TLSv1.2), autenticazione Redis AUTH (`auth_token`) e connessioni Node.js con `socket: { tls: true }`.
  - **Amazon S3**: Crittografia server-side SSE-S3 (`AES256`), blocco accessi pubblici, policy che nega richieste non-HTTPS (`aws:SecureTransport: "false"`) e accesso riservato a CloudFront OAC con SigV4.
  - **Amazon SQS + DLQ**: Crittografia at-rest abilitata (SSE-SQS) e trasporto su HTTPS.
  - **Amazon EBS (EC2)**: Crittografia abilitata su tutti i volumi `root_block_device`.
  - **CloudFront CDN**: Forzatura HTTPS (`redirect-to-https`) su tutti i path, policy Security Headers completa (CSP, HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff) e header di verifica `X-Origin-Verify` verso l'ALB.
- **Isolamento di Rete & VPC Endpoints**:
  - RDS ed ElastiCache risiedono in Subnet Private Multi-AZ non accessibili da Internet.
  - **Gateway VPC Endpoints** per S3 e DynamoDB per instradamento interno a costo zero.
  - Security Group EC2: porte NodePort `30000-32767` accessibili unicamente dall'ALB Security Group.
  - Pod Kubernetes isolati tramite **Calico CNI NetworkPolicies** con ingress selectors specifici per il namespace `ingress-nginx`.
- **Hardening dei Container**:
  - Container eseguiti come utente non-root (`UID/GID 10001`).
  - `readOnlyRootFilesystem: true`, `allowPrivilegeEscalation: false` e drop di tutte le Linux capabilities (`drop: ALL`).
- **Pipeline CI/CD DevSecOps**:
  - Scansione secret con **Gitleaks** (bloccante).
  - Scansione statica del codice (SAST) con **Semgrep**.
  - Scansione IaC di Terraform e manifesti Kubernetes con **Checkov**.

---

## 💰 Ottimizzazione dei Costi AWS

L'infrastruttura è stata architettata per minimizzare i costi fissi:
- **Nessun NAT Gateway provisionato**: I nodi EC2 usano l'Internet Gateway per il traffico outbound, evitando ~$32-35/mese per gateway.
- **Risorse Serverless On-Demand**: DynamoDB e SQS operano in modalità Pay-Per-Request ($0 di costo a riposo).
- **CloudFront PriceClass_100**: Limitato a Nord America ed Europa per il minor costo per GB.
- **Teardown Pulito**: Tutti i bucket S3 e registri ECR sono configurati con `force_destroy = true` e RDS con `skip_final_snapshot = true` per garantire una cancellazione rapida e totale con `terraform destroy`.

---

## 🧹 Teardown dell'Infrastruttura

Per distruggere tutte le risorse allocate su AWS ed azzerare i costi:

```bash
cd terraform
terraform destroy -var-file="dev.tfvars" -auto-approve
```

---

## 📄 Licenza

Questo progetto è distribuito sotto licenza **MIT**. Consulta il file [LICENSE](LICENSE) per ulteriori dettagli.