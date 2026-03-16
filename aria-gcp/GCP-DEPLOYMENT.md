# ☁️ Google Cloud Deployment — ARIA Agent

This document serves as **proof of Google Cloud deployment** for the Gemini Live Agent Challenge submission.

---

## 🏗️ Google Cloud Services Used

| Service | Purpose | File |
|---|---|---|
| **Vertex AI** | Gemini 2.0 Flash multimodal inference | `server/index.js` |
| **Cloud Run** | Serverless container deployment | `Dockerfile`, `deploy.sh` |
| **Firestore** | Conversation session persistence | `server/index.js` |
| **Secret Manager** | Secure API key storage | `server/index.js` |
| **Cloud Build** | CI/CD pipeline (auto-deploy on push) | `cloudbuild.yaml` |
| **Container Registry** | Docker image storage | `cloudbuild.yaml` |

---

## 🤖 Vertex AI — Gemini 2.0 Flash Integration

The core AI inference runs on **Vertex AI** using the `gemini-2.0-flash-001` model:

```javascript
// server/index.js — Lines 68–85
const vertexAI = new VertexAI({
  project: PROJECT_ID,   // Google Cloud Project ID
  location: LOCATION,    // us-central1
});

const generativeModel = vertexAI.getGenerativeModel({
  model: "gemini-2.0-flash-001",
  systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
  generationConfig: {
    maxOutputTokens: 1024,
    temperature: 0.7,
  },
});

// Multimodal call — text + image
const result = await generativeModel.generateContent({ contents });
```

---

## 🗄️ Firestore — Session Persistence

Every conversation session is stored and retrieved from **Firestore**:

```javascript
// Save session
await firestore.collection("aria_sessions").doc(sessionId).set({
  sessionId,
  messages,
  updatedAt: Firestore.Timestamp.now(),
});

// Load session
const doc = await firestore.collection("aria_sessions").doc(sessionId).get();
```

---

## 🚀 Cloud Run — Deployment

The backend is deployed as a containerized service on **Cloud Run**:

```bash
# One-command deployment
gcloud run deploy aria-agent \
  --image gcr.io/$PROJECT_ID/aria-agent \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=$PROJECT_ID"
```

---

## 🔁 Cloud Build — CI/CD Pipeline

Automatic deployment on every `git push` to `main` via `cloudbuild.yaml`:

```
git push → Cloud Build trigger → Docker build → Container Registry → Cloud Run
```

---

## 🌐 Live Endpoints

Once deployed, the following endpoints are available:

| Endpoint | Method | Description |
|---|---|---|
| `/health` | GET | Service health + GCP config |
| `/api/chat` | POST | Multimodal chat with Gemini |
| `/api/session/:id` | GET | Retrieve conversation history |
| `/api/session/:id` | DELETE | Clear session from Firestore |

### Example API Call

```bash
curl -X POST https://aria-agent-xxxx-uc.a.run.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "user-session-123",
    "message": "What do you see in this image?",
    "imageBase64": "<base64_encoded_image>"
  }'
```

### Example Response

```json
{
  "reply": "I can see a vibrant cityscape at night with...",
  "sessionId": "user-session-123"
}
```

---

## 📁 File Structure

```
aria-gcp/
├── server/
│   └── index.js        ← Vertex AI + Firestore + Secret Manager
├── Dockerfile          ← Cloud Run container config
├── cloudbuild.yaml     ← CI/CD pipeline
├── deploy.sh           ← One-command deployment script
├── package.json        ← GCP SDK dependencies
└── GCP-DEPLOYMENT.md   ← This file (proof of GCP usage)
```

---

*ARIA — Advanced Real-time Intelligence Agent · Gemini Live Agent Challenge · March 2026*
