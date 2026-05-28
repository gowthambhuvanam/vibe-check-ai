"use strict";

require("dotenv").config();
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const multer = require("multer");
const path = require("path");

const { initWhatsApp, getChats, getChatMessages, getStatus, setBroadcast, disconnect } = require("./src/whatsapp");
const { extractSignals, parseExportText, buildSummaryText } = require("./src/signals");
const { analyzeConversation } = require("./src/analyzer");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

app.use(express.json());
app.use(express.static(path.join(__dirname, "../client")));

// WebSocket broadcast to all connected clients
function broadcast(data) {
  const payload = JSON.stringify(data);
  wss.clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) ws.send(payload);
  });
}

setBroadcast(broadcast);

// WhatsApp routes
app.post("/api/whatsapp/connect", async (req, res) => {
  try {
    const status = getStatus();
    if (status === "ready") return res.json({ status: "ready" });
    if (status === "qr_pending" || status === "initializing") return res.json({ status });
    initWhatsApp().catch(err => {
      console.error("WhatsApp init error:", err.message);
      broadcast({ type: "error", data: err.message });
    });
    res.json({ status: "connecting" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/whatsapp/status", (req, res) => {
  res.json({ status: getStatus() });
});

app.get("/api/whatsapp/chats", async (req, res) => {
  try {
    const chats = await getChats();
    res.json({ chats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/whatsapp/analyze/:chatId", async (req, res) => {
  try {
    const { chatId } = req.params;
    const { yourName = "You", relationshipType = "close-friend" } = req.body;

    const messages = await getChatMessages(chatId, 80);
    if (messages.length < 4) {
      return res.status(400).json({ error: "Not enough messages in this chat to analyze." });
    }

    const signals = extractSignals(messages, yourName);
    const summaryText = buildSummaryText(signals);
    const result = await analyzeConversation(summaryText, signals.excerptEarly, signals.excerptLate, relationshipType);

    res.json({
      ...result,
      stats: {
        totalMessages: signals.totalMessages,
        theirCount: signals.theirCount,
        yourCount: signals.yourCount,
        responseTimeTrend: signals.responseTimeTrend,
        lengthTrend: signals.lengthTrend,
      }
    });
  } catch (err) {
    console.error("Analysis error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/whatsapp/disconnect", async (req, res) => {
  await disconnect();
  res.json({ status: "disconnected" });
});

// Export file analysis route
app.post("/api/export/analyze", upload.single("file"), async (req, res) => {
  try {
    let text = "";

    if (req.file) {
      text = req.file.buffer.toString("utf-8");
    } else if (req.body.text) {
      text = req.body.text;
    } else {
      return res.status(400).json({ error: "Provide a file upload or paste text in the request body." });
    }

    const yourName = req.body.yourName || "You";
    const relationshipType = req.body.relationshipType || "close-friend";
    const messages = parseExportText(text, yourName);

    if (messages.length < 4) {
      return res.status(400).json({ error: "Could not parse enough messages. Check the format." });
    }

    const signals = extractSignals(messages, yourName);
    const summaryText = buildSummaryText(signals);
    const result = await analyzeConversation(summaryText, signals.excerptEarly, signals.excerptLate, relationshipType);

    res.json({
      ...result,
      stats: {
        totalMessages: signals.totalMessages,
        theirCount: signals.theirCount,
        yourCount: signals.yourCount,
        responseTimeTrend: signals.responseTimeTrend,
        lengthTrend: signals.lengthTrend,
      }
    });
  } catch (err) {
    console.error("Export analysis error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Catch-all: serve frontend
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/index.html"));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
