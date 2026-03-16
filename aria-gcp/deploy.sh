#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  ARIA — Google Cloud Deployment Script
#  Deploys to Cloud Run with Vertex AI + Firestore
# ═══════════════════════════════════════════════════════════════

set -e  # Exit on any error

# ── Config — update these ────────────────────────────────────────
PROJECT_ID="your-gcp-project-id"
REGION="us-central1"
SERVICE_NAME="aria-agent"
IMAGE_NAME="gcr.io/$PROJECT_ID/$SERVICE_NAME"

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║     ARIA — Google Cloud Deployment               ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ── Step 1: Set active GCP project ───────────────────────────────
echo "▶ Setting GCP project: $PROJECT_ID"
gcloud config set project $PROJECT_ID

# ── Step 2: Enable required APIs ─────────────────────────────────
echo "▶ Enabling Google Cloud APIs..."
gcloud services enable \
  run.googleapis.com \
  aiplatform.googleapis.com \
  firestore.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com \
  containerregistry.googleapis.com

echo "  ✓ APIs enabled"

# ── Step 3: Initialize Firestore ─────────────────────────────────
echo "▶ Setting up Firestore database..."
gcloud firestore databases create \
  --region=$REGION \
  --type=firestore-native 2>/dev/null || echo "  ✓ Firestore already exists"

# ── Step 4: Build & push Docker image ────────────────────────────
echo "▶ Building and pushing Docker image..."
gcloud builds submit \
  --tag $IMAGE_NAME \
  --project $PROJECT_ID

echo "  ✓ Image pushed: $IMAGE_NAME"

# ── Step 5: Deploy to Cloud Run ───────────────────────────────────
echo "▶ Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image $IMAGE_NAME \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=$PROJECT_ID,VERTEX_LOCATION=$REGION" \
  --service-account "aria-agent-sa@$PROJECT_ID.iam.gserviceaccount.com"

echo "  ✓ Deployed to Cloud Run"

# ── Step 6: Get service URL ───────────────────────────────────────
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
  --region $REGION \
  --format "value(status.url)")

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║  ✅ Deployment Complete!                         ║"
echo "╠══════════════════════════════════════════════════╣"
echo "║  Service URL : $SERVICE_URL"
echo "║  Health Check: $SERVICE_URL/health"
echo "║  Chat API    : $SERVICE_URL/api/chat"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ── Step 7: Verify deployment ─────────────────────────────────────
echo "▶ Running health check..."
curl -s "$SERVICE_URL/health" | python3 -m json.tool
echo ""
echo "✓ ARIA is live on Google Cloud Run!"
