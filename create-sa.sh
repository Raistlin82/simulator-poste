#!/bin/bash
set -e

echo "🔧 Creazione Service Account per GitHub Actions..."

# 1. Crea namespace se non esiste
kubectl create namespace simulator-poste --dry-run=client -o yaml | kubectl apply -f -

# 2. Crea service account
kubectl create serviceaccount github-actions -n simulator-poste --dry-run=client -o yaml | kubectl apply -f -

# 3. Crea ClusterRole con permessi necessari
cat <<YAML | kubectl apply -f -
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: github-actions-deployer
rules:
- apiGroups: [""]
  resources: ["namespaces", "configmaps", "secrets", "services", "pods"]
  verbs: ["get", "list", "create", "update", "patch", "delete"]
- apiGroups: ["apps"]
  resources: ["deployments", "replicasets"]
  verbs: ["get", "list", "create", "update", "patch", "delete"]
- apiGroups: ["networking.k8s.io"]
  resources: ["ingresses"]
  verbs: ["get", "list", "create", "update", "patch", "delete"]
YAML

# 4. Bind ClusterRole al service account
cat <<YAML | kubectl apply -f -
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: github-actions-deployer-binding
subjects:
- kind: ServiceAccount
  name: github-actions
  namespace: simulator-poste
roleRef:
  kind: ClusterRole
  name: github-actions-deployer
  apiGroup: rbac.authorization.k8s.io
YAML

# 5. Crea Secret per il token (per K8s 1.24+)
cat <<YAML | kubectl apply -f -
apiVersion: v1
kind: Secret
metadata:
  name: github-actions-token
  namespace: simulator-poste
  annotations:
    kubernetes.io/service-account.name: github-actions
type: kubernetes.io/service-account-token
YAML

echo "✅ Service Account creato!"
echo ""
echo "Attendere che il token venga generato..."
sleep 5

# 6. Estrai il token
TOKEN=$(kubectl get secret github-actions-token -n simulator-poste -o jsonpath='{.data.token}' | base64 -d)
CA_CERT=$(kubectl get secret github-actions-token -n simulator-poste -o jsonpath='{.data.ca\.crt}')
API_SERVER=$(kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}')

# 7. Crea nuovo kubeconfig
cat > lutech/kubeconfig-sa.yaml <<KUBECONFIG
apiVersion: v1
kind: Config
clusters:
- name: kyma-cluster
  cluster:
    certificate-authority-data: ${CA_CERT}
    server: ${API_SERVER}
contexts:
- name: github-actions-context
  context:
    cluster: kyma-cluster
    user: github-actions-user
    namespace: simulator-poste
current-context: github-actions-context
users:
- name: github-actions-user
  user:
    token: ${TOKEN}
KUBECONFIG

echo ""
echo "✅ Kubeconfig creato: lutech/kubeconfig-sa.yaml"
echo ""
echo "📋 Ora esegui questo comando per aggiornare il GitHub Secret:"
echo ""
echo "cat lutech/kubeconfig-sa.yaml | base64 | pbcopy"
echo ""
echo "Poi aggiorna il secret KUBECONFIG su GitHub con il valore copiato."
