# 📊 Studio Comparativo: Kubernetes Self-Hosted su EC2 (Kubeadm) vs AWS EKS Managed

Questo documento approfondisce il confronto architetturale, operativo ed economico tra i due principali approcci per eseguire carichi Kubernetes su AWS, come richiesto dall'analisi accademica del progetto **Kaloora**.

---

## 1. Panoramica dei Due Approcci

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ METODO 1: Kubernetes Self-Hosted su EC2 (Kubeadm + Ansible)                                 │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  [ Control Plane (EC2) ]              [ Worker 1 (EC2) ]          [ Worker 2 (EC2) ]        │
│  ┌────────────────────────┐           ┌────────────────────────┐  ┌───────────────────────┐ │
│  │ etcd + API Server      │           │ Kubelet + Containerd   │  │ Kubelet + Containerd  │ │
│  │ Controller + Scheduler │◄─────────►│ Pods Microservizi      │◄►│ Pods Microservizi     │ │
│  │ Configurato via Ansible│           │ CNI Flannel            │  │ CNI Flannel           │ │
│  └────────────────────────┘           └────────────────────────┘  └───────────────────────┘ │
│                                                                                             │
│  * Responsabilità gestione: TU (Control Plane, Certificati TLS, etcd, aggiornamenti K8s)    │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ METODO 2: AWS Elastic Kubernetes Service (EKS Managed)                                      │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  [ AWS EKS Managed Control Plane ]        [ Managed Node Group (EC2 Worker Instances) ]     │
│  ┌─────────────────────────────────┐      ┌────────────────────────┐  ┌───────────────────┐ │
│  │ 99.95% SLA Multi-AZ             │      │ Kubelet + Containerd   │  │ Kubelet           │ │
│  │ etcd HA + Auto-Healing          │◄────►│ Pods Microservizi      │◄►│ Pods Microservizi │ │
│  │ Certificati & Patching Auto AWS │      │ VPC CNI Nativo         │  │ VPC CNI           │ │
│  └─────────────────────────────────┘      └────────────────────────┘  └───────────────────┘ │
│                                                                                             │
│  * Responsabilità gestione: AWS gestisce il Control Plane, TU gestisci solo i carichi       │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Matrice Comparativa Dettagliata

| Dimensione | Metodo 1: K8s Self-Hosted su EC2 (Kubeadm) | Metodo 2: AWS EKS (Managed K8s) |
| :--- | :--- | :--- |
| **Control Plane Management** | 🔴 **Manuale**: Inizializzato con `kubeadm init`, etcd a singolo nodo (o cluster manuale). | 🟢 **Gestito da AWS**: Multi-AZ ridondato, autoguarigione e backup automatici di etcd. |
| **Ruolo di Ansible** | 🟢 **Essenziale**: Necessario per il setup del SO, runtime containerd, kubeadm e join dei nodi. | ⚪ **Superfluo**: I Managed Node Groups di EKS si autoinizializzano con AMI AWS ottimizzate. |
| **Alta Disponibilità (HA)** | ⚠️ Se la VM del Control Plane fallisce o si riavvia, il cluster smette di accettare modifiche. | 🟢 **99.95% SLA**: AWS garantisce alta disponibilità geografica distribuita su 3 Availability Zone. |
| **Ciclo di Vita Certificati** | 🔴 I certificati TLS generati da Kubeadm **scadono ogni 365 giorni** e richiedono `kubeadm certs renew`. | 🟢 **Completamente trasparente**: AWS ruota e gestisce i certificati internamente senza disservizi. |
| **Aggiornamenti di Versione (Upgrade)** | 🔴 Richiede upgrade manuale sequenziale di `kubeadm`, `kubelet`, `kubectl` nodo per nodo. | 🟢 **1-Click Upgrade**: Aggiornamenti controllati tramite console/Terraform con rolling update dei nodi. |
| **Networking Pod (CNI)** | ⚪ **Flannel / Calico**: Crea una rete overlay virtuale (es. `10.244.0.0/16`) su VXLAN. | 🟢 **AWS VPC CNI**: Assegna a ciascun pod un IP reale nativo della subnet VPC di AWS. |
| **Costo Orario Control Plane** | 🟢 **Costo della sola VM EC2**: (es. `t3.medium` ~$0.0416/ora). | 🔴 **Tariffa fissa EKS**: **$0.10/ora** (~$73/mese solo per il cluster) + costo dei worker node. |
| **Valore Didattico / Trasparenza** | 🏆 **Massimo**: Mostra come funzionano internamente etcd, API Server, Kubelet e CNI sotto il cofano. | 🚀 **Produzione Enterprise**: Astrae la complessità infrastrutturale per focalizzarsi sui container. |

---

## 3. Analisi Economica a Confronto

### Scenario A: Test Temporaneo (3 Ore di Esecuzione)

| Componente | Metodo 1: EC2 Kubeadm | Metodo 2: AWS EKS |
| :--- | :---: | :---: |
| Control Plane (3h) | $0.12 (1x `t3.medium`) | $0.30 (EKS cluster fee) |
| Worker Nodes (3h, 2x `t3.medium`) | $0.25 | $0.25 |
| Servizi Gestiti (RDS, DynamoDB, SQS, Redis, S3) | $0.45 | $0.45 |
| **Totale Test (3 Ore)** | **~$0.82 USD (~0.75 €)** | **~$1.00 USD (~0.92 €)** |

### Scenario B: Esercizio Continuo (1 Mese a Regime 24/7)

| Componente | Metodo 1: EC2 Kubeadm | Metodo 2: AWS EKS |
| :--- | :---: | :---: |
| Control Plane (730h) | ~$30.00 (1x `t3.medium`) | **~$73.00** (EKS fixed fee) |
| Worker Nodes (2x `t3.medium`) | ~$60.00 | ~$60.00 |
| Servizi Gestiti | ~$35.00 | ~$35.00 |
| **Totale Mensile** | **~$125.00 / mese** | **~$168.00 / mese** |

---

## 4. Conclusioni e Raccomandazione per la Presentazione

1. **Perché iniziare con la Build 1 (EC2 + Kubeadm + Ansible)**:
   * Permette di dimostrare la piena padronanza del ciclo di automazione IaC (**Terraform**) unito al Configuration Management (**Ansible**).
   * Spiega in modo trasparente l'avvio dei componenti core di Kubernetes (`kube-apiserver`, `kube-controller-manager`, `kube-scheduler`, `etcd`, `kube-proxy`).
2. **Quando migrare a EKS (Build 2)**:
   * In un contesto aziendale di produzione, la spesa aggiuntiva di ~$43/mese per EKS è ampiamente giustificata dall'eliminazione dell'overhead umano per la manutenzione dei nodi master, certificati e garanzia di SLA al 99.95%.
