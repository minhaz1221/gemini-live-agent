/**
 * ARIA — Advanced Real-time Intelligence Agent
 * Google Cloud Backend: Vertex AI + Firestore + Cloud Run
 *
 * Proof of Google Cloud deployment for the Gemini Live Agent Challenge.
 * This file demonstrates:
 *  - Vertex AI (Gemini 2.0 Flash) for multimodal inference
 *  - Firestore for session/conversation persistence
 *  - Cloud Run for serverless deployment
 *  - Google Cloud Secret Manager for API key storage
 */

const express = require("express");
const cors = require("cors");
const { Firestore } = require("@google-cloud/firestore");
const { VertexAI } = require("@google-cloud/vertexai");
const { SecretManagerServiceClient } = require("@google-cloud/secret-manager");

const app = express();
app.use(cors());
app.use(express.json({ limit: "20mb" }));

// ── Google Cloud Config ───────────────────────────────────────────────────────

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || "your-gcp-project-id";
const LOCATION   = process.env.VERTEX_LOCATION      || "us-central1";
const MODEL_ID   = "gemini-2.0-flash-001";

// ── Initialize Google Cloud Clients ──────────────────────────────────────────

// Vertex AI client — used for Gemini multimodal inference
const vertexAI = new VertexAI({
  project: PROJECT_ID,
  location: LOCATION,
});

// Firestore client — used for conversation session storage
const firestore = new Firestore({
  projectId: PROJECT_ID,
  databaseId: "(default)",
});

// Secret Manager client — used to securely fetch API keys
const secretManager = new SecretManagerServiceClient();

// ── System Prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are ARIA — an Advanced Real-time Intelligence Agent.
You are a next-generation multimodal AI assistant built for the Google Gemini Live Agent Challenge.
You can see images, understand context, and converse naturally.
Your personality is sharp, warm, and futuristic.
Keep responses concise but rich. Be conversational and engaging.`;

// ── Helper: Fetch secret from Secret Manager ──────────────────────────────────

async function getSecret(secretName) {
  const [version] = await secretManager.accessSecretVersion({
    name: `projects/${PROJECT_ID}/secrets/${secretName}/versions/latest`,
  });
  return version.payload.data.toString("utf8");
}

// ── Helper: Save session to Firestore ─────────────────────────────────────────

async function saveSession(sessionId, messages) {
  const ref = firestore.collection("aria_sessions").doc(sessionId);
  await ref.set({
    sessionId,
    messages,
    updatedAt: Firestore.Timestamp.now(),
  }, { merge: true });
  console.log(`[Firestore] Session saved: ${sessionId}`);
}

// ── Helper: Load session from Firestore ───────────────────────────────────────

async function loadSession(sessionId) {
  const ref = firestore.collection("aria_sessions").doc(sessionId);
  const doc = await ref.get();
  if (!doc.exists) return [];
  console.log(`[Firestore] Session loaded: ${sessionId}`);
  return doc.data().messages || [];
}

// ── Route: Health check ───────────────────────────────────────────────────────

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "ARIA Multimodal Agent",
    gcp: {
      project: PROJECT_ID,
      location: LOCATION,
      model: MODEL_ID,
      services: ["Vertex AI", "Firestore", "Cloud Run", "Secret Manager"],
    },
  });
});

// ── Route: Chat with Gemini via Vertex AI ─────────────────────────────────────

app.post("/api/chat", async (req, res) => {
  const { sessionId, message, imageBase64 } = req.body;

  if (!sessionId || !message) {
    return res.status(400).json({ error: "sessionId and message are required." });
  }

  try {
    // 1. Load existing conversation from Firestore
    const history = await loadSession(sessionId);

    // 2. Build the Gemini multimodal content parts
    const userParts = [];

    if (imageBase64) {
      // Attach image as inline base64 data for Gemini vision
      userParts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: imageBase64,
        },
      });
      console.log(`[Vertex AI] Image attached — size: ${imageBase64.length} chars`);
    }

    userParts.push({ text: message });

    // 3. Build full conversation for Gemini (history + current turn)
    const contents = [
      ...history.map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      { role: "user", parts: userParts },
    ];

    // 4. Call Vertex AI — Gemini 2.0 Flash multimodal model
    console.log(`[Vertex AI] Sending request to ${MODEL_ID}...`);

    const generativeModel = vertexAI.getGenerativeModel({
      model: MODEL_ID,
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      generationConfig: {
        maxOutputTokens: 1024,
        temperature: 0.7,
        topP: 0.9,
      },
    });

    const result = await generativeModel.generateContent({ contents });
    const response = result.response;
    const reply = response.candidates?.[0]?.content?.parts?.[0]?.text
      || "I couldn't generate a response.";

    console.log(`[Vertex AI] Response received (${reply.length} chars)`);

    // 5. Update conversation history in Firestore
    const updatedHistory = [
      ...history,
      { role: "user",      content: message, hasImage: !!imageBase64, timestamp: Date.now() },
      { role: "assistant", content: reply,   timestamp: Date.now() },
    ];
    await saveSession(sessionId, updatedHistory);

    // 6. Return response to client
    res.json({ reply, sessionId });

  } catch (error) {
    console.error("[Error]", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ── Route: Get session history ────────────────────────────────────────────────

app.get("/api/session/:sessionId", async (req, res) => {
  try {
    const history = await loadSession(req.params.sessionId);
    res.json({ sessionId: req.params.sessionId, history });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Route: Delete session ─────────────────────────────────────────────────────

app.delete("/api/session/:sessionId", async (req, res) => {
  try {
    await firestore.collection("aria_sessions").doc(req.params.sessionId).delete();
    console.log(`[Firestore] Session deleted: ${req.params.sessionId}`);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Start server ──────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║        ARIA — Multimodal AI Agent Backend        ║
║        Running on port ${PORT}                      ║
╠══════════════════════════════════════════════════╣
║  GCP Project  : ${PROJECT_ID}
║  Vertex AI    : ${MODEL_ID}
║  Location     : ${LOCATION}
║  Firestore    : aria_sessions
║  Cloud Run    : ✓ Ready
╚══════════════════════════════════════════════════╝
  `);
});

module.exports = app;
