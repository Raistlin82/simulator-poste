#!/bin/bash
# Script per debuggare il deployment fallito su Kyma

NAMESPACE="simulator-poste"
DEPLOYMENT="simulator-poste-backend"

echo "================================================"
echo "🔍 Debugging Backend Deployment Failure"
echo "================================================"
echo ""

echo "1️⃣ Checking pod status..."
kubectl get pods -n $NAMESPACE -l app=simulator-poste-backend

echo ""
echo "2️⃣ Getting pod name..."
POD_NAME=$(kubectl get pods -n $NAMESPACE -l app=simulator-poste-backend -o jsonpath='{.items[0].metadata.name}')

if [ -z "$POD_NAME" ]; then
    echo "❌ No pod found!"
    exit 1
fi

echo "Pod: $POD_NAME"
echo ""

echo "3️⃣ Checking pod events..."
kubectl describe pod $POD_NAME -n $NAMESPACE | grep -A 20 "Events:"

echo ""
echo "4️⃣ Checking pod logs (last 50 lines)..."
kubectl logs $POD_NAME -n $NAMESPACE --tail=50

echo ""
echo "5️⃣ Checking previous pod logs (if crashed)..."
kubectl logs $POD_NAME -n $NAMESPACE --previous --tail=50 2>/dev/null || echo "No previous logs (pod didn't crash)"

echo ""
echo "6️⃣ Checking deployment status..."
kubectl get deployment $DEPLOYMENT -n $NAMESPACE -o wide

echo ""
echo "7️⃣ Checking replica sets..."
kubectl get rs -n $NAMESPACE -l app=simulator-poste-backend

echo ""
echo "================================================"
echo "✅ Debug information collected"
echo "================================================"
