import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json());

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:7b";
const MCP_URL = process.env.MCP_URL || "http://192.168.0.88:3000/mcp";

// ─── MCP helpers ────────────────────────────────────────────────────────────

let toolsCache = null;

async function mcpCall(method, params = {}) {
  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: Date.now() }),
  });

  const raw = await res.text();
  // Gestisce sia JSON puro che SSE (data: {...})
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (t.startsWith("data:")) {
      try { return JSON.parse(t.slice(5).trim()); } catch {}
    } else if (t.startsWith("{")) {
      try { return JSON.parse(t); } catch {}
    }
  }
  return JSON.parse(raw);
}

async function getTools() {
  if (toolsCache) return toolsCache;
  const res = await mcpCall("tools/list");
  toolsCache = res.result?.tools ?? [];
  return toolsCache;
}

// Converte tool MCP → formato Ollama
function mcpToolToOllama(tool) {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema ?? { type: "object", properties: {} },
    },
  };
}

async function callTool(name, args) {
  const res = await mcpCall("tools/call", { name, arguments: args });
  const content = res.result?.content ?? [];
  return content.map((c) => c.text ?? JSON.stringify(c)).join("\n");
}

// ─── Ollama chat con tool loop ────────────────────────────────────────────────

async function chatWithTools(messages) {
  const tools = await getTools();
  const ollamaTools = tools.map(mcpToolToOllama);

  let history = [...messages];
  const toolCallsLog = [];

  // Agentic loop: max 5 round-trip per evitare loop infiniti
  for (let round = 0; round < 5; round++) {
    const ollamaRes = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: history,
        tools: ollamaTools,
        stream: false,
        options: { temperature: 0.3 },
      }),
    });

    if (!ollamaRes.ok) {
      const err = await ollamaRes.text();
      throw new Error(`Ollama error ${ollamaRes.status}: ${err}`);
    }

    const data = await ollamaRes.json();
    const msg = data.message;
    history.push(msg);

    // Nessun tool call → risposta finale
    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      return { reply: msg.content, toolCalls: toolCallsLog };
    }

    // Esegue tutti i tool call richiesti
    for (const tc of msg.tool_calls) {
      const fnName = tc.function.name;
      const fnArgs = tc.function.arguments ?? {};

      console.log(`[tool] ${fnName}`, JSON.stringify(fnArgs).slice(0, 120));
      toolCallsLog.push({ tool: fnName, args: fnArgs });

      let result;
      try {
        result = await callTool(fnName, fnArgs);
      } catch (e) {
        result = `Errore: ${e.message}`;
      }

      history.push({ role: "tool", content: result });
    }
  }

  // Fallback se supera i round
  const last = history.filter((m) => m.role === "assistant").pop();
  return { reply: last?.content ?? "Nessuna risposta.", toolCalls: toolCallsLog };
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// GET /api/models → lista modelli Ollama disponibili
app.get("/api/models", async (req, res) => {
  try {
    const r = await fetch(`${OLLAMA_URL}/api/tags`);
    const data = await r.json();
    res.json(data.models ?? []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/tools → lista strumenti MCP disponibili
app.get("/api/tools", async (req, res) => {
  try {
    toolsCache = null; // forza refresh
    const tools = await getTools();
    res.json(tools);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/chat → messaggio utente, risposta assistente
// Body: { messages: [{role, content}], model?: string }
app.post("/api/chat", async (req, res) => {
  const { messages, model } = req.body;
  if (!messages?.length) return res.status(400).json({ error: "messages required" });

  if (model) {
    // Override modello per questa richiesta
    global._modelOverride = model;
  }

  const systemPrompt = {
    role: "system",
    content: `Sei un assistente esperto di open data. Hai accesso a strumenti per interrogare portali CKAN.
Quando l'utente chiede di cercare dataset, usa SEMPRE gli strumenti disponibili per interrogare dati reali.
Il portale principale è https://www.dati.gov.it/opendata (Italia), ma puoi usare qualsiasi URL CKAN.
Rispondi sempre in italiano in modo chiaro e conciso. Presenta i risultati in modo leggibile.
Se trovi dataset rilevanti, mostra: nome, organizzazione, descrizione breve e link.`,
  };

  try {
    const modelToUse = global._modelOverride || OLLAMA_MODEL;
    const savedModel = OLLAMA_MODEL;
    // Patch temporanea del modello
    if (model) process.env.OLLAMA_MODEL = model;

    const fullMessages = [systemPrompt, ...messages];
    const { reply, toolCalls } = await chatWithTools(fullMessages);

    if (model) process.env.OLLAMA_MODEL = savedModel;

    res.json({ reply, toolCalls });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/health
app.get("/api/health", async (req, res) => {
  const status = { backend: "ok", ollama: "unknown", mcp: "unknown" };
  try {
    await fetch(`${OLLAMA_URL}/api/tags`);
    status.ollama = "ok";
  } catch {}
  try {
    await mcpCall("tools/list");
    status.mcp = "ok";
  } catch {}
  res.json(status);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend pronto su http://localhost:${PORT}`));
