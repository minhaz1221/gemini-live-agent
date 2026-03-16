import { useState, useRef, useEffect, useCallback } from "react";

const SYSTEM_PROMPT = `You are ARIA — an Advanced Real-time Intelligence Agent. You are a next-generation multimodal AI assistant built for the Google Gemini Live Agent Challenge.

You can see images, understand context, and converse naturally. Your personality is sharp, warm, and futuristic. You are helpful, curious, and proactive.

When given an image:
- Describe what you see with precision and insight
- Offer useful observations, suggestions, or analysis
- Connect visual context to the user's questions

Keep responses concise but rich. Use bullet points only when listing multiple items. Be conversational and engaging. Never be robotic.`;

const MODEL = "claude-sonnet-4-20250514";

// ── helpers ──────────────────────────────────────────────────────────────────

function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(",")[1]);
    r.onerror = () => rej(new Error("Read failed"));
    r.readAsDataURL(file);
  });
}

function formatTime(d) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ── Message bubble ────────────────────────────────────────────────────────────

function Bubble({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div style={{
      display: "flex",
      justifyContent: isUser ? "flex-end" : "flex-start",
      marginBottom: "18px",
      animation: "slideUp 0.35s cubic-bezier(.22,.68,0,1.2) both",
    }}>
      {!isUser && (
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          background: "linear-gradient(135deg,#00e5ff,#7c4dff)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 15, marginRight: 10, flexShrink: 0, marginTop: 2,
          boxShadow: "0 0 14px rgba(0,229,255,.4)",
        }}>✦</div>
      )}
      <div style={{ maxWidth: "75%" }}>
        {msg.image && (
          <img src={`data:image/jpeg;base64,${msg.image}`}
            alt="uploaded"
            style={{
              width: "100%", maxWidth: 260, borderRadius: 12,
              marginBottom: 6, display: "block",
              border: "1px solid rgba(255,255,255,.12)",
            }} />
        )}
        <div style={{
          background: isUser
            ? "linear-gradient(135deg,#7c4dff,#651fff)"
            : "rgba(255,255,255,.06)",
          border: isUser ? "none" : "1px solid rgba(255,255,255,.1)",
          borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
          padding: "12px 16px",
          color: "#f0f0f0",
          fontSize: 14,
          lineHeight: 1.6,
          whiteSpace: "pre-wrap",
          backdropFilter: "blur(8px)",
        }}>
          {msg.text || (msg.isTyping && <TypingDots />)}
        </div>
        <div style={{
          fontSize: 11, color: "rgba(255,255,255,.3)",
          marginTop: 4,
          textAlign: isUser ? "right" : "left",
          paddingLeft: isUser ? 0 : 4,
        }}>{formatTime(msg.time)}</div>
      </div>
      {isUser && (
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          background: "linear-gradient(135deg,#ff4081,#f50057)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 15, marginLeft: 10, flexShrink: 0, marginTop: 2,
        }}>◈</div>
      )}
    </div>
  );
}

function TypingDots() {
  return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "center", height: 18 }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 6, height: 6, borderRadius: "50%",
          background: "#00e5ff",
          animation: `bounce 1.2s ${i * 0.2}s infinite`,
          display: "inline-block",
        }} />
      ))}
    </span>
  );
}

// ── Waveform ──────────────────────────────────────────────────────────────────

function Waveform({ active }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3, height: 24 }}>
      {[...Array(7)].map((_, i) => (
        <div key={i} style={{
          width: 3, borderRadius: 2,
          background: active ? "#00e5ff" : "rgba(255,255,255,.2)",
          height: active ? `${8 + Math.sin(i * 1.2) * 10}px` : "6px",
          animation: active ? `wave 1s ${i * 0.1}s ease-in-out infinite alternate` : "none",
          transition: "all .3s",
        }} />
      ))}
    </div>
  );
}

// ── Image preview strip ───────────────────────────────────────────────────────

function ImagePreview({ src, onRemove }) {
  return (
    <div style={{ position: "relative", display: "inline-block", marginRight: 8 }}>
      <img src={src} alt="preview" style={{
        width: 60, height: 60, objectFit: "cover",
        borderRadius: 10, border: "2px solid #7c4dff",
      }} />
      <button onClick={onRemove} style={{
        position: "absolute", top: -6, right: -6,
        width: 18, height: 18, borderRadius: "50%",
        background: "#ff4081", border: "none", color: "#fff",
        fontSize: 10, cursor: "pointer", display: "flex",
        alignItems: "center", justifyContent: "center",
        padding: 0,
      }}>✕</button>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────

export default function App() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "Hello! I'm ARIA — your multimodal AI agent. I can see images, understand context, and converse naturally.\n\nUpload an image or just say hi. What can I help you with? ✦",
      time: new Date(),
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState("chat"); // chat | vision | creative
  const bottomRef = useRef(null);
  const fileRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleImage = async (file) => {
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setImagePreview(preview);
    setImageFile(file);
    const b64 = await fileToBase64(file);
    setImageBase64(b64);
  };

  const removeImage = () => {
    setImagePreview(null);
    setImageFile(null);
    setImageBase64(null);
  };

  const buildApiMessages = (history, userText, userImage) => {
    const apiMessages = [];

    // Convert history (skip typing indicators)
    for (const m of history) {
      if (m.isTyping || !m.text) continue;
      if (m.role === "assistant") {
        apiMessages.push({ role: "assistant", content: m.text });
      } else {
        // user — could have image
        const parts = [];
        if (m.image) {
          parts.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: m.image } });
        }
        if (m.text) parts.push({ type: "text", text: m.text });
        apiMessages.push({ role: "user", content: parts.length === 1 && parts[0].type === "text" ? m.text : parts });
      }
    }

    // Current user turn
    const parts = [];
    if (userImage) {
      parts.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: userImage } });
    }
    parts.push({ type: "text", text: userText || (userImage ? "What do you see in this image?" : "") });
    apiMessages.push({
      role: "user",
      content: parts.length === 1 ? parts[0].text : parts,
    });

    return apiMessages;
  };

  const sendMessage = useCallback(async (overrideText) => {
    const text = overrideText ?? input.trim();
    if (!text && !imageBase64) return;
    setError(null);

    const userMsg = {
      role: "user",
      text: text || (imageBase64 ? "Analyze this image." : ""),
      image: imageBase64 || null,
      time: new Date(),
    };

    const typingMsg = { role: "assistant", isTyping: true, text: "", time: new Date() };

    setMessages(prev => [...prev, userMsg, typingMsg]);
    setInput("");
    removeImage();
    setLoading(true);

    try {
      const apiMessages = buildApiMessages(messages, userMsg.text, userMsg.image);

      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: apiMessages,
        }),
      });

      const data = await resp.json();
      const reply = data.content?.find(b => b.type === "text")?.text || "Sorry, I couldn't generate a response.";

      setMessages(prev => {
        const copy = [...prev];
        const idx = copy.findLastIndex(m => m.isTyping);
        if (idx !== -1) copy[idx] = { role: "assistant", text: reply, time: new Date() };
        return copy;
      });
    } catch (e) {
      setError("Connection error. Please try again.");
      setMessages(prev => prev.filter(m => !m.isTyping));
    } finally {
      setLoading(false);
    }
  }, [input, imageBase64, messages]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const quickActions = [
    { label: "🔍 Analyze image", text: "Analyze this image in detail." },
    { label: "💡 Suggest ideas", text: "Give me creative ideas based on what you see." },
    { label: "📝 Describe scene", text: "Describe this scene as if writing a story." },
    { label: "🌐 Translate", text: "Translate any text you see in this image." },
  ];

  const modeColors = {
    chat: "#7c4dff",
    vision: "#00e5ff",
    creative: "#ff4081",
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#080b14",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      fontFamily: "'Sora', 'Segoe UI', sans-serif",
      color: "#f0f0f0",
      padding: "0 0 20px",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes slideUp { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:translateY(0) } }
        @keyframes bounce { 0%,100% { transform:scaleY(1) } 50% { transform:scaleY(2) } }
        @keyframes wave { from { height:6px } to { height:20px } }
        @keyframes pulse { 0%,100% { opacity:.6 } 50% { opacity:1 } }
        @keyframes spin { to { transform:rotate(360deg) } }
        @keyframes glow { 0%,100%{box-shadow:0 0 20px rgba(0,229,255,.3)} 50%{box-shadow:0 0 40px rgba(0,229,255,.7)} }
        textarea:focus { outline:none; }
        textarea { resize:none; }
        ::-webkit-scrollbar { width:4px }
        ::-webkit-scrollbar-track { background:transparent }
        ::-webkit-scrollbar-thumb { background:rgba(255,255,255,.15); border-radius:4px }
      `}</style>

      {/* Header */}
      <div style={{
        width: "100%", maxWidth: 720,
        padding: "20px 20px 0",
      }}>
        <div style={{
          background: "linear-gradient(135deg,rgba(124,77,255,.15),rgba(0,229,255,.08))",
          border: "1px solid rgba(255,255,255,.08)",
          borderRadius: 20,
          padding: "20px 24px",
          marginBottom: 12,
          backdropFilter: "blur(20px)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 14,
                  background: "linear-gradient(135deg,#7c4dff,#00e5ff)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22, animation: "glow 3s ease-in-out infinite",
                }}>✦</div>
                <div>
                  <div style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 20, letterSpacing: ".5px" }}>
                    ARIA
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,.4)", letterSpacing: "2px", textTransform: "uppercase" }}>
                    Multimodal Live Agent
                  </div>
                </div>
              </div>
            </div>

            {/* Mode selector */}
            <div style={{ display: "flex", gap: 6 }}>
              {["chat","vision","creative"].map(m => (
                <button key={m} onClick={() => setMode(m)} style={{
                  padding: "6px 14px",
                  borderRadius: 20,
                  border: `1px solid ${mode === m ? modeColors[m] : "rgba(255,255,255,.1)"}`,
                  background: mode === m ? `${modeColors[m]}22` : "transparent",
                  color: mode === m ? modeColors[m] : "rgba(255,255,255,.4)",
                  fontSize: 11, fontWeight: 600, cursor: "pointer",
                  textTransform: "uppercase", letterSpacing: "1px",
                  transition: "all .2s",
                }}>{m}</button>
              ))}
            </div>
          </div>

          {/* Status bar */}
          <div style={{ display: "flex", gap: 20, marginTop: 14, flexWrap: "wrap" }}>
            {[
              { icon: "◎", label: "Multimodal", color: "#00e5ff" },
              { icon: "◈", label: "Vision-enabled", color: "#7c4dff" },
              { icon: "◉", label: "Real-time", color: "#ff4081" },
              { icon: "◆", label: "Google Cloud Ready", color: "#69f0ae" },
            ].map(s => (
              <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11 }}>
                <span style={{ color: s.color, animation: "pulse 2s infinite" }}>{s.icon}</span>
                <span style={{ color: "rgba(255,255,255,.5)" }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chat window */}
      <div style={{
        width: "100%", maxWidth: 720,
        flex: 1,
        padding: "0 20px",
        display: "flex",
        flexDirection: "column",
      }}>
        <div style={{
          flex: 1,
          minHeight: 340, maxHeight: 440,
          overflowY: "auto",
          padding: "20px",
          background: "rgba(255,255,255,.025)",
          border: "1px solid rgba(255,255,255,.06)",
          borderRadius: 20,
          marginBottom: 12,
        }}>
          {messages.map((msg, i) => <Bubble key={i} msg={msg} />)}
          {error && (
            <div style={{
              textAlign: "center", color: "#ff4081",
              fontSize: 13, padding: "8px",
              background: "rgba(255,64,129,.08)",
              borderRadius: 10, marginTop: 8,
            }}>{error}</div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Quick actions */}
        {imageBase64 && (
          <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
            {quickActions.map(a => (
              <button key={a.label} onClick={() => sendMessage(a.text)} disabled={loading} style={{
                padding: "6px 12px",
                borderRadius: 16,
                border: "1px solid rgba(0,229,255,.3)",
                background: "rgba(0,229,255,.06)",
                color: "#00e5ff",
                fontSize: 11, cursor: "pointer",
                transition: "all .2s",
              }}>{a.label}</button>
            ))}
          </div>
        )}

        {/* Input area */}
        <div style={{
          background: "rgba(255,255,255,.04)",
          border: "1px solid rgba(255,255,255,.1)",
          borderRadius: 18,
          padding: "12px 16px",
          backdropFilter: "blur(12px)",
        }}>
          {imagePreview && (
            <div style={{ marginBottom: 10 }}>
              <ImagePreview src={imagePreview} onRemove={removeImage} />
            </div>
          )}
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={mode === "vision" ? "Upload an image and ask anything…" : mode === "creative" ? "Describe your creative vision…" : "Ask ARIA anything…"}
              rows={2}
              style={{
                flex: 1, background: "transparent",
                border: "none", color: "#f0f0f0",
                fontSize: 14, lineHeight: 1.6,
                fontFamily: "'Sora', sans-serif",
              }}
            />
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
              {/* Waveform */}
              <div onClick={() => setListening(l => !l)} style={{ cursor: "pointer" }} title="Voice (UI only)">
                <Waveform active={listening} />
              </div>

              {/* Upload */}
              <button onClick={() => fileRef.current?.click()} style={{
                width: 38, height: 38, borderRadius: "50%",
                background: "rgba(124,77,255,.2)",
                border: "1px solid rgba(124,77,255,.5)",
                color: "#7c4dff", fontSize: 16, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all .2s",
              }} title="Upload image">🖼</button>
              <input ref={fileRef} type="file" accept="image/*"
                style={{ display: "none" }}
                onChange={e => handleImage(e.target.files[0])} />

              {/* Send */}
              <button onClick={() => sendMessage()} disabled={loading || (!input.trim() && !imageBase64)} style={{
                width: 38, height: 38, borderRadius: "50%",
                background: loading ? "rgba(0,229,255,.1)" : "linear-gradient(135deg,#7c4dff,#00e5ff)",
                border: "none", color: "#fff", fontSize: 16, cursor: loading ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all .2s",
                opacity: loading ? .5 : 1,
              }}>
                {loading
                  ? <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>◌</span>
                  : "➤"}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          textAlign: "center", fontSize: 11,
          color: "rgba(255,255,255,.2)", marginTop: 12,
          letterSpacing: "1px",
        }}>
          ARIA · Gemini Live Agent Challenge · Powered by Multimodal AI
        </div>
      </div>
    </div>
  );
}