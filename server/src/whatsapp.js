"use strict";

const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode");

let waClient = null;
let clientStatus = "disconnected"; // disconnected | qr_pending | ready
let broadcastFn = null;

function setBroadcast(fn) {
  broadcastFn = fn;
}

function broadcast(data) {
  if (broadcastFn) broadcastFn(data);
}

function getStatus() {
  return clientStatus;
}

async function initWhatsApp() {
  if (waClient) return;

  clientStatus = "initializing";

  const puppeteerOpts = {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  };

  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    puppeteerOpts.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  waClient = new Client({
    authStrategy: new LocalAuth({ clientId: "chat-analyzer" }),
    puppeteer: puppeteerOpts,
  });

  waClient.on("qr", async (qr) => {
    clientStatus = "qr_pending";
    try {
      const qrImageBase64 = await qrcode.toDataURL(qr);
      broadcast({ type: "qr", data: qrImageBase64 });
    } catch (err) {
      console.error("QR generation error:", err.message);
    }
  });

  waClient.on("ready", () => {
    clientStatus = "ready";
    broadcast({ type: "status", data: "ready" });
    console.log("WhatsApp Web connected");
  });

  waClient.on("authenticated", () => {
    broadcast({ type: "status", data: "authenticated" });
  });

  waClient.on("auth_failure", (msg) => {
    clientStatus = "disconnected";
    broadcast({ type: "error", data: "Authentication failed. Please reload and scan again." });
  });

  waClient.on("disconnected", () => {
    clientStatus = "disconnected";
    waClient = null;
    broadcast({ type: "status", data: "disconnected" });
  });

  waClient.on("message", async (msg) => {
    // broadcast new message event so frontend can trigger re-analysis if monitoring
    broadcast({ type: "new_message", data: { from: msg.from, body: msg.body } });
  });

  await waClient.initialize();
}

async function getChats() {
  if (!waClient || clientStatus !== "ready") throw new Error("WhatsApp not connected");
  const chats = await waClient.getChats();
  return chats
    .filter(c => !c.isGroup)
    .slice(0, 30)
    .map(c => ({
      id: c.id._serialized,
      name: c.name || c.id.user,
      lastMessage: c.lastMessage?.body?.slice(0, 60) || "",
      timestamp: c.lastMessage?.timestamp || 0,
      unreadCount: c.unreadCount,
    }))
    .sort((a, b) => b.timestamp - a.timestamp);
}

async function getChatMessages(chatId, limit = 80) {
  if (!waClient || clientStatus !== "ready") throw new Error("WhatsApp not connected");
  const chat = await waClient.getChatById(chatId);
  const rawMessages = await chat.fetchMessages({ limit });
  const myNumber = waClient.info.wid._serialized;

  return rawMessages.map((m, i) => {
    const sender = m.fromMe ? "you" : "them";
    let responseTimeMinutes = null;

    if (i > 0) {
      const prev = rawMessages[i - 1];
      if (prev.fromMe !== m.fromMe) {
        responseTimeMinutes = (m.timestamp - prev.timestamp) / 60;
      }
    }

    return {
      sender,
      content: m.body || "",
      timestamp: m.timestamp,
      responseTimeMinutes,
    };
  }).filter(m => m.content.trim());
}

async function disconnect() {
  if (waClient) {
    await waClient.destroy();
    waClient = null;
    clientStatus = "disconnected";
  }
}

module.exports = { initWhatsApp, getChats, getChatMessages, getStatus, setBroadcast, disconnect };
