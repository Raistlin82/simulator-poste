# Kyma Deployment Guide

## Prerequisites

1. **SAP BTP Account** with Kyma environment enabled
2. **kubectl** installed locally
3. **Docker** for building images locally (optional)
4. **GitHub repository** with access to GitHub Container Registry (ghcr.io)

## Configuration Files

| File | Purpose | Requires Update |
|------|---------|-----------------|
| `k8s/namespace.yaml` | Namespace with istio-injection | No |
| `k8s/apirule.yaml` | API Gateway routing | **Yes** - domain |
| `k8s/backend/deployment.yaml` | Backend pod spec | No |
| `k8s/backend/configmap.yaml` | Backend env vars | **Yes** - domain |
| `k8s/backend/service.yaml` | Backend ClusterIP | No |
| `k8s/backend/pvc.yaml` | SQLite persistent storage | No |
| `k8s/frontend/deployment.yaml` | Frontend pod spec | No |
| `k8s/frontend/configmap.yaml` | Frontend env vars (reference) | **Yes** - domain |
| `k8s/frontend/service.yaml` | Frontend ClusterIP | No |
| `k8s/secrets.yaml.template` | OIDC credentials template | No |

## Setup Steps

### 1. Create Kyma Instance

1. Log in to SAP BTP Cockpit
2. Navigate to your Subaccount → Kyma Environment
3. Create a new Kyma instance (or use existing)
4. Download the **kubeconfig** from "KubeconfigURL"
5. Note the **cluster domain** (e.g., `xxxxxx.kyma.ondemand.com`)

### 2. Update Domain in Configuration Files

Replace `KYMA_CLUSTER_DOMAIN` with your actual cluster domain in:

```bash
# Quick sed command to replace all occurrences
DOMAIN="your-cluster-domain.kyma.ondemand.com"

sed -i '' "s/KYMA_CLUSTER_DOMAIN/$DOMAIN/g" k8s/apirule.yaml
sed -i '' "s/KYMA_CLUSTER_DOMAIN/$DOMAIN/g" k8s/backend/configmap.yaml
sed -i '' "s/KYMA_CLUSTER_DOMAIN/$DOMAIN/g" k8s/frontend/configmap.yaml
```

Files to update:
- `k8s/apirule.yaml` (line 14)
- `k8s/backend/configmap.yaml` (line 14)
- `k8s/frontend/configmap.yaml` (lines 13-14)

### 3. Update SAP IAS (Identity Authentication Service)

1. Access SAP IAS Admin Console: `https://asojzafbi.accounts.ondemand.com/admin`
2. Find the OIDC application for simulator-poste
3. Update **Redirect URIs**:
   - `https://simulator-poste.{DOMAIN}/callback`
   - `https://simulator-poste.{DOMAIN}`
4. Update **Post Logout Redirect URIs**:
   - `https://simulator-poste.{DOMAIN}`

### 4. Configure GitHub Secrets

Add/update the following secrets in your GitHub repository:

| Secret | Description |
|--------|-------------|
| `KYMA_KUBECONFIG` | Base64 encoded kubeconfig file |
| `KYMA_APP_URL` | Full application URL (e.g., `https://simulator-poste.xxx.kyma.ondemand.com`) |
| `OIDC_CLIENT_ID` | SAP IAS OIDC client ID |
| `OIDC_CLIENT_SECRET` | SAP IAS OIDC client secret |
| `OIDC_AUDIENCE` | OIDC audience |
| `OIDC_ISSUER` | SAP IAS issuer URL (`https://asojzafbi.accounts.ondemand.com`) |

To encode kubeconfig for GitHub secret:
```bash
cat /path/to/kubeconfig.yaml | base64 | tr -d '\n'
```

### 5. Manual Deployment (First Time)

```bash
# Set kubeconfig
export KUBECONFIG=/path/to/kubeconfig.yaml

# Verify connection
kubectl cluster-info

# Create namespace
kubectl apply -f k8s/namespace.yaml

# Create PVC for SQLite
kubectl apply -f k8s/backend/pvc.yaml

# Create OIDC secrets
kubectl create secret generic oidc-credentials \
  --from-literal=client-id="YOUR_CLIENT_ID" \
  --from-literal=client-secret="YOUR_CLIENT_SECRET" \
  --from-literal=audience="YOUR_AUDIENCE" \
  --from-literal=issuer="https://asojzafbi.accounts.ondemand.com" \
  -n simulator-poste

# Deploy ConfigMaps
kubectl apply -f k8s/backend/configmap.yaml
kubectl apply -f k8s/frontend/configmap.yaml

# Deploy Backend
kubectl apply -f k8s/backend/deployment.yaml
kubectl apply -f k8s/backend/service.yaml

# Deploy Frontend
kubectl apply -f k8s/frontend/deployment.yaml
kubectl apply -f k8s/frontend/service.yaml

# Deploy APIRule
kubectl apply -f k8s/apirule.yaml
```

### 6. Verify Deployment

```bash
# Check pods
kubectl get pods -n simulator-poste

# Check services
kubectl get services -n simulator-poste

# Check APIRule status
kubectl get apirules -n simulator-poste -o wide

# Check logs
kubectl logs -l app=simulator-poste-backend -n simulator-poste
kubectl logs -l app=simulator-poste-frontend -n simulator-poste
```

## Automated Deployment (GitHub Actions)

After initial setup, deployments are automated via `.github/workflows/deploy.yml`:

- **Trigger**: Push to `main` or `kyma` branches
- **Builds**: Docker images for backend and frontend
- **Pushes**: Images to ghcr.io
- **Deploys**: All k8s resources to Kyma cluster

## Architecture

```
                                   ┌─────────────────────────────┐
                                   │     Kyma API Gateway        │
                                   │   (kyma-system/kyma-gateway)│
                                   └──────────────┬──────────────┘
                                                  │
                                   ┌──────────────┴──────────────┐
                                   │         APIRule             │
                                   │   simulator-poste           │
                                   └──────────────┬──────────────┘
                                                  │
                      ┌───────────────────────────┼───────────────────────────┐
                      │                           │                           │
              /api/*  │                  /health/*│                       /*  │
                      ▼                           ▼                           ▼
          ┌───────────────────┐       ┌───────────────────┐       ┌───────────────────┐
          │  backend-service  │       │  backend-service  │       │ frontend-service  │
          │     :8000         │       │     :8000         │       │      :80          │
          └─────────┬─────────┘       └─────────┬─────────┘       └─────────┬─────────┘
                    │                           │                           │
                    ▼                           ▼                           ▼
          ┌───────────────────┐                               ┌───────────────────┐
          │     Backend       │                               │     Frontend      │
          │  (FastAPI/Python) │                               │    (React/Vite)   │
          │   1 replica       │                               │    2 replicas     │
          └─────────┬─────────┘                               └───────────────────┘
                    │
                    ▼
          ┌───────────────────┐
          │   PVC (1Gi)       │
          │   SQLite DB       │
          └───────────────────┘
```

## Troubleshooting

### Pods not starting
```bash
kubectl describe pod <pod-name> -n simulator-poste
kubectl logs <pod-name> -n simulator-poste
```

### APIRule not working
```bash
kubectl get apirules -n simulator-poste -o yaml
```
Check the `status` section for errors.

### CORS errors
Verify `FRONTEND_URL` in backend ConfigMap matches the actual domain.

### OIDC errors
1. Verify SAP IAS redirect URIs match
2. Check OIDC secrets are correctly created
3. Verify issuer URL is correct

## Security Notes

- All pods run as non-root user (UID 1000)
- `allowPrivilegeEscalation: false` is set
- SQLite uses `Recreate` strategy to avoid data corruption
- OIDC credentials are stored in Kubernetes Secrets
- APIRule uses `noAuth: true` (authentication handled by frontend OIDC)
