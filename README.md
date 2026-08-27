# Guida Operativa Passo-Passo: KalooraEC2 (Cluster Kubernetes Self-Managed su EC2)

## 1. Obiettivo dell'Infrastruttura
Questa guida descrive la procedura operativa per effettuare il provisioning completo, la configurazione e il rilascio dell'applicazione Kaloora sull'infrastruttura **`KalooraEC2`**. 
In questo ambiente, il calcolo è affidato a un cluster Kubernetes self-managed (istallato tramite Kubeadm su istanze Amazon EC2 Ubuntu 24.04), mentre i dati, la messaggistica, la cache e la distribuzione del frontend sono delegati ai servizi gestiti di AWS (RDS PostgreSQL, DynamoDB, SQS, ElastiCache Redis, S3 e CloudFront).

---

## 2. Prerequisiti di Sistema
Prima di avviare il deployment, assicurarsi di disporre dei seguenti strumenti installati e configurati sulla propria macchina di lavoro:

1. **AWS CLI v2**: configurata con credenziali dotate di privilegi sufficienti per la creazione delle risorse (VPC, EC2, RDS, DynamoDB, SQS, IAM, CloudFront, S3, ECR):
   ```bash
   aws configure
   # Inserire AWS Access Key ID, Secret Access Key, Regione di default (es. us-east-1) e output format (json)
   ```
2. **Terraform** ($\ge 1.5.0$): per il provisioning dichiarativo dell'infrastruttura.
3. **Ansible** ($\ge 2.12$): per la configurazione del sistema operativo e l'installazione di Kubernetes.
4. **Docker**: attivo localmente per la build delle immagini multi-architettura (`linux/amd64`).
5. **OpenSSH Client**: per la generazione e l'utilizzo delle chiavi di accesso ai nodi.

---

## 3. Fase 1: Provisioning dell'Infrastruttura con Terraform

### 3.1 Setup del Remote State Backend (S3 + DynamoDB Locking)
Prima di effettuare il provisioning dell'infrastruttura, è necessario istanziare il bucket S3 e la tabella DynamoDB per il distributed state locking di Terraform:

1. Entrare nella cartella di setup del backend:
   ```bash
   cd KalooraEC2/terraform/backend_setup
   ```

2. Inizializzare ed applicare il provisioning del backend:
   ```bash
   terraform init
   terraform apply -auto-approve
   ```

3. L'output mostrerà il nome del bucket S3 generato (es. `kaloora-tf-state-xxxxxx`) e della tabella DynamoDB (`kaloora-tf-locks`).

4. Tornare nella cartella `terraform/` principale:
   ```bash
   cd ..
   ```

5. Modificare il file `main.tf` nel blocco `backend "s3"` e aggiungere il nome del bucket appena creato:
   ```hcl
   terraform {
     backend "s3" {
       bucket         = "<NOME_BUCKET_GENERATO>"
       key            = "cluster/terraform.tfstate"
       region         = "us-east-1"
       encrypt        = true
       dynamodb_table = "kaloora-tf-locks"
     }
   }
   ```

### 3.2 Provisioning delle Risorse del Cluster

1. Generare la coppia di chiavi SSH che verrà associata alle istanze EC2:
   ```bash
   ssh-keygen -t ed25519 -f id_ed25519 -N ""
   ```

2. Inizializzare Terraform per scaricare i provider necessari ed agganciare il backend remoto:
   ```bash
   terraform init
   ```

3. Verificare il piano di esecuzione ed applicare il provisioning:
   ```bash
   terraform apply -auto-approve
   ```

   **Cosa fa questa fase:**
   - Crea la VPC dedicata (`10.0.0.0/16`) distribuita su 2 Availability Zone con Subnet Pubbliche e Private.
   - Crea i Gateway VPC Endpoints per S3 e DynamoDB.
   - Definisce i Security Groups a catena (ALB $\rightarrow$ Nodi K8s $\rightarrow$ RDS/ElastiCache).
   - Crea le risorse di persistenza gestita (RDS PostgreSQL, DynamoDB On-Demand, SQS + DLQ, ElastiCache Redis).
   - Crea il bucket S3 e la distribuzione CloudFront con Origin Access Control (OAC) e header di verifica `X-Origin-Verify`.
   - Crea l'istanza EC2 Control Plane e l'Auto Scaling Group dei nodi Worker con Launch Template (IMDSv2 obbligatorio).
   - Genera automaticamente i file locali `ansible/hosts.ini` e `k8s/secret.yaml` contenenti gli endpoint e le credenziali generate.

---

## 4. Fase 2: Configurazione del Cluster K8s con Ansible

Una volta che le istanze EC2 sono avviate e raggiungibili:

1. Tornare nella cartella radice del progetto:
   ```bash
   cd ..
   ```

2. Eseguire il playbook Ansible principale:
   ```bash
   ansible-playbook -i ansible/hosts.ini ansible/site.yml
   ```

   **Cosa fa questa fase:**
   - **`00-prerequisites.yml`**: Configura lo swapfile da 2GB con swappiness controllata, attiva i moduli kernel `overlay` e `br_netfilter`, imposta i parametri di rete sysctl, installa `containerd` (configurato con `SystemdCgroup = true`) e installa i pacchetti `kubelet`, `kubeadm`, `kubectl` v1.31.
   - **`01-control-plane.yml`**: Inizializza il Control Plane con `kubeadm init`, installa il CNI Calico v3.28.0 per la rete dei pod, genera un token di join permanente e lo carica in modo sicuro su AWS SSM Parameter Store (`/kaloora/k8s/join_command`).
   - I nodi Worker dell'Auto Scaling Group, al loro avvio, eseguono lo script di user data (`worker_bootstrap.sh.tpl`), interrogano SSM Parameter Store, recuperano il comando ed effettuano il join automatico al cluster.

---

## 5. Fase 3: Deployment dei Microservizi e Frontend

Per automatizzare la compilazione delle immagini, il caricamento dei file statici e l'applicazione dei manifesti Kubernetes:

1. Dalla cartella radice di `KalooraEC2`, eseguire lo script orchestratore:
   ```bash
   ./deploy-aws.sh
   ```

   **Sequenza di operazioni eseguite dallo script:**
   1. **Recupero parametri**: Estrae gli URL di ECR, il nome del bucket S3, l'ID di distribuzione CloudFront e l'IP del Control Plane dai Terraform outputs.
   2. **Deploy Frontend**: Sincronizza i file statici (`frontend/`) sul bucket S3 ed esegue l'invalidazione della cache di CloudFront (`/*`).
   3. **Build & Push Immagini**: Compila le immagini Docker per architettura `linux/amd64` (`user-service`, `diary-service`, `analytics-service`), effettua il login al registry Amazon ECR e carica le immagini con tag `v1.0.0`.
   4. **Sincronizzazione Manifesti**: Trasferisce i manifesti Kubernetes sul Control Plane tramite SSH incapsulato in AWS SSM Session Manager (ProxyCommand), garantendo l'accesso sicuro senza esporre la porta 22.   
   5. **Applicazione Manifesti K8s**:
      - Crea il namespace `kaloora`.
      - Applica i segreti e il CronJob per il rinnovo automatico del token ECR ogni 6 ore.
      - Applica le Network Policies Calico (`default-deny` e whitelist di traffico).
      - Applica i Deployment e i Service dei 3 microservizi.
      - Installa l'Ingress Controller Nginx ed applica la risorsa Ingress (in ascolto su NodePort 30080 per il traffico proveniente dall'ALB).
      - Esegue il seeding iniziale degli alimenti e delle ricette nel database DynamoDB.

---

## 6. Fase 4: Validazione Funzionale e Test degli Endpoint

Al termine dell'esecuzione, lo script mostrerà l'URL pubblico di CloudFront (es. `https://d1xxxxxxxxxxxx.cloudfront.net`).

1. **Test dell'Health Check:**
   ```bash
   curl -I https://<CLOUDFRONT_DOMAIN>/healthz
   # Risposta attesa: HTTP/2 200 OK
   ```

2. **Accesso all'Applicazione:**
   - Aprire l'URL `https://<CLOUDFRONT_DOMAIN>` in un browser web.
   - Verificare il corretto caricamento dell'interfaccia utente.

3. **Verifica dei Flussi Applicativi:**
   - **Registrazione & Login**: Creare un nuovo account utente con i parametri antropometrici e verificare il corretto calcolo metabolico (BMR e TDEE).
   - **Diario Alimentare**: Inserire un pasto nel diario e verificare la persistenza immediata su DynamoDB.
   - **Flusso Asincrono & Cache**: Verificare che l'evento venga inoltrato alla coda SQS, consumato da `analytics-service` e che le statistiche nutrizionali vengano memorizzate nella cache Redis.

---

## 7. Fase 5: Procedura di Teardown e Azzeramento Risorse

Per distruggere tutte le risorse allocate su AWS ed evitare costi indesiderati:

1. Posizionarsi nella cartella Terraform:
   ```bash
   cd KalooraEC2/terraform
   ```

2. Eseguire il comando di distruzione:
   ```bash
   terraform destroy -auto-approve
   ```

*Nota*: I bucket S3 e i repository ECR sono configurati con `force_destroy = true` e il database RDS con `skip_final_snapshot = true` per garantire una deallocazione pulita e senza blocchi.
