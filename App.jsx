import { useState, useRef, useEffect } from "react";
import ChatMessage from "./components/ChatMessage";
import ToolCallBadge from "./components/ToolCallBadge";
import StatusBar from "./components/StatusBar";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

const SUGGESTIONS = [
  "Cerca dataset sulla qualità dell'aria",
  "Trova dataset sui rifiuti in Lombardia",
  "Mostra dataset sul traffico a Milano",
  "Cerca dati sulla popolazione italiana",
  "Dataset sull'energia rinnovabile",
];

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState("");
  const [models, setModels] = useState([]);
  const [health, setHealth] = useState(null);
  const [toolCalls, setToolCalls] = useState([]);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    fetchHealth();
    fetchModels();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function fetchHealth() {
    try {
      const r = await fetch(`${BACKEND_URL}/api/health`);
      setHealth(await r.json());
    } catch {
      setHealth({ backend: "error", ollama: "error", mcp: "error" });
    }
  }

  async function fetchModels() {
    try {
      const r = await fetch(`${BACKEND_URL}/api/models`);
      const data = await r.json();
      setModels(data);
      if (data.length > 0) setModel(data[0].name);
    } catch {}
  }

  async function sendMessage(text) {
    if (!text.trim() || loading) return;

    const userMsg = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setToolCalls([]);

    try {
      const r = await fetch(`${BACKEND_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          model: model || undefined,
        }),
      });

      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();

      setMessages([...newMessages, { role: "assistant", content: data.reply }]);
      setToolCalls(data.toolCalls ?? []);
    } catch (e) {
      setMessages([
        ...newMessages,
        { role: "assistant", content: `❌ Errore: ${e.message}` },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">⬡</div>
          <span className="logo-text">CKAN<br />Chat</span>
        </div>

        <StatusBar health={health} onRefresh={fetchHealth} />

        <div className="sidebar-section">
          <div className="section-label">MODELLO</div>
          <select
            className="model-select"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          >
            {models.length === 0 && (
              <option value="">Nessun modello trovato</option>
            )}
            {models.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        {toolCalls.length > 0 && (
          <div className="sidebar-section">
            <div className="section-label">ULTIMA QUERY</div>
            <div className="tool-calls-list">
              {toolCalls.map((tc, i) => (
                <ToolCallBadge key={i} toolCall={tc} />
              ))}
            </div>
          </div>
        )}

        <div className="sidebar-section suggestions-section">
          <div className="section-label">SUGGERIMENTI</div>
          {SUGGESTIONS.map((s, i) => (
            <button
              key={i}
              className="suggestion-btn"
              onClick={() => sendMessage(s)}
              disabled={loading}
            >
              {s}
            </button>
          ))}
        </div>

        <button
          className="clear-btn"
          onClick={() => { setMessages([]); setToolCalls([]); }}
        >
          Nuova conversazione
        </button>
      </aside>

      <main className="chat-area">
        <div className="messages-container">
          {messages.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">◈</div>
              <h2>Esplora i dati aperti italiani</h2>
              <p>
                Chiedimi di cercare dataset su qualsiasi argomento.<br />
                Interrogo direttamente dati.gov.it e altri portali CKAN.
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <ChatMessage key={i} message={msg} />
          ))}

          {loading && (
            <div className="message assistant">
              <div className="message-bubble loading-bubble">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <div className="input-area">
          <div className="input-wrapper">
            <textarea
              ref={inputRef}
              className="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Cerca dataset, fai domande sui dati aperti..."
              rows={1}
              disabled={loading}
            />
            <button
              className="send-btn"
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
          <div className="input-hint">
            Invio per inviare · Shift+Invio per andare a capo
          </div>
        </div>
      </main>
    </div>
  );
}
