"use strict";

const $ = id => document.getElementById(id);

// --- State ---
let ws = null;
let selectedChatId = null;


// --- Tabs ---
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".mode-section").forEach(s => {
      s.classList.remove("active");
      s.classList.add("hidden");
    });
    tab.classList.add("active");
    const section = $(`${tab.dataset.mode}-mode`);
    section.classList.remove("hidden");
    section.classList.add("active");
  });
});

// --- WebSocket ---
function connectWS() {
  if (ws && ws.readyState < 2) return;
  const proto = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(`${proto}://${location.host}`);

  ws.onmessage = e => {
    const msg = JSON.parse(e.data);
    handleWSMessage(msg);
  };

  ws.onclose = () => {
    setTimeout(connectWS, 3000);
  };
}

function handleWSMessage(msg) {
  if (msg.type === "qr") {
    showStep("qr-step-qr");
    $("qr-image").src = msg.data;
  } else if (msg.type === "status") {
    if (msg.data === "ready") {
      loadChats();
    } else if (msg.data === "disconnected") {
      showStep("qr-step-connect");
    }
  } else if (msg.type === "error") {
    alert("WhatsApp error: " + msg.data);
    showStep("qr-step-connect");
  }
}

// --- QR Flow ---
function showStep(stepId) {
  ["qr-step-connect", "qr-step-qr", "qr-step-chats", "qr-step-analyzing"].forEach(id => {
    const el = $(id);
    if (el) el.classList.add("hidden");
  });
  const target = $(stepId);
  if (target) target.classList.remove("hidden");
}

$("btn-connect").addEventListener("click", async () => {
  connectWS();
  showStep("qr-step-qr");
  $("qr-image").src = "";
  const res = await fetch("/api/whatsapp/connect", { method: "POST" });
  const data = await res.json();
  if (data.status === "ready") {
    loadChats();
  }
});

async function loadChats() {
  showStep("qr-step-chats");
  const res = await fetch("/api/whatsapp/chats");
  const data = await res.json();
  const list = $("chat-list");
  list.innerHTML = "";

  if (!data.chats || data.chats.length === 0) {
    list.innerHTML = '<p style="color:var(--muted);font-size:13px;">No conversations found.</p>';
    return;
  }

  data.chats.forEach(chat => {
    const item = document.createElement("div");
    item.className = "chat-item";
    item.innerHTML = `
      <div>
        <div class="chat-name">${escapeHtml(chat.name)}</div>
        <div class="chat-preview">${escapeHtml(chat.lastMessage || "")}</div>
      </div>
      ${chat.unreadCount > 0 ? `<span class="chat-unread">${chat.unreadCount}</span>` : ""}
    `;
    item.addEventListener("click", () => analyzeQRChat(chat.id));
    list.appendChild(item);
  });
}

async function analyzeQRChat(chatId) {
  selectedChatId = chatId;
  showStep("qr-step-analyzing");
  try {
    const res = await fetch(`/api/whatsapp/analyze/${chatId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ yourName: "You" })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    renderResults(data);
  } catch (err) {
    alert("Analysis failed: " + err.message);
    loadChats();
  }
}

$("btn-disconnect").addEventListener("click", async () => {
  await fetch("/api/whatsapp/disconnect", { method: "POST" });
  showStep("qr-step-connect");
});

// --- Export Flow ---
const uploadArea = $("upload-area");
const fileInput = $("file-input");

$("upload-trigger").addEventListener("click", () => fileInput.click());

uploadArea.addEventListener("dragover", e => {
  e.preventDefault();
  uploadArea.classList.add("drag-over");
});

uploadArea.addEventListener("dragleave", () => uploadArea.classList.remove("drag-over"));

uploadArea.addEventListener("drop", e => {
  e.preventDefault();
  uploadArea.classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  if (file) setFile(file);
});

fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) setFile(fileInput.files[0]);
});

let selectedFile = null;

function setFile(file) {
  selectedFile = file;
  $("file-name").textContent = file.name;
}

$("btn-analyze-export").addEventListener("click", async () => {
  const text = $("export-text").value.trim();
  const yourName = $("your-name-export").value.trim() || "You";

  if (!selectedFile && !text) {
    alert("Upload a .txt file or paste chat text.");
    return;
  }

  $("btn-analyze-export").disabled = true;
  $("btn-analyze-export").textContent = "Analyzing...";

  try {
    let res;
    if (selectedFile) {
      const form = new FormData();
      form.append("file", selectedFile);
      form.append("yourName", yourName);
      res = await fetch("/api/export/analyze", { method: "POST", body: form });
    } else {
      const form = new FormData();
      form.append("text", text);
      form.append("yourName", yourName);
      res = await fetch("/api/export/analyze", { method: "POST", body: form });
    }

    const data = await res.json();
    if (data.error) throw new Error(data.error);
    renderResults(data);
  } catch (err) {
    alert("Analysis failed: " + err.message);
  } finally {
    $("btn-analyze-export").disabled = false;
    $("btn-analyze-export").textContent = "Analyze Chat";
  }
});

// --- Results Rendering ---
const natureColors = {
  Romantic: { bg: "#ff6b8a22", color: "#ff6b8a", border: "#ff6b8a" },
  Toxic: { bg: "#e74c3c22", color: "#e74c3c", border: "#e74c3c" },
  Loving: { bg: "#ff8c4222", color: "#ff8c42", border: "#ff8c42" },
  Playful: { bg: "#f1c40f22", color: "#f1c40f", border: "#f1c40f" },
  Casual: { bg: "#3498db22", color: "#3498db", border: "#3498db" },
  Fading: { bg: "#88888822", color: "#888888", border: "#888888" },
  "One-sided": { bg: "#9b59b622", color: "#9b59b6", border: "#9b59b6" },
  Deep: { bg: "#1abc9c22", color: "#1abc9c", border: "#1abc9c" },
  Complicated: { bg: "#e67e2222", color: "#e67e22", border: "#e67e22" },
  Distant: { bg: "#7f8c8d22", color: "#7f8c8d", border: "#7f8c8d" },
  Obsessive: { bg: "#c0392b22", color: "#c0392b", border: "#c0392b" },
  Warm: { bg: "#e91e8c22", color: "#e91e8c", border: "#e91e8c" },
  Friendly: { bg: "#25d36622", color: "#25d366", border: "#25d366" },
  Flirty: { bg: "#fd79a822", color: "#fd79a8", border: "#fd79a8" },
};

const scoreConfig = {
  interest_level: { label: "Interest Level", color: "#25d366" },
  ghosting_risk: { label: "Ghosting Risk", color: "#e74c3c" },
  emotional_warmth: { label: "Emotional Warmth", color: "#e91e8c" },
  humor_playfulness: { label: "Humor", color: "#f1c40f" },
  conversation_balance: { label: "Balance", color: "#3498db" },
  toxicity_level: { label: "Toxicity", color: "#e67e22" },
  romantic_tension: { label: "Romantic Tension", color: "#fd79a8" },
  friendship_depth: { label: "Friendship Depth", color: "#9b59b6" },
};

const scoreDescriptions = {
  interest_level: "How engaged and curious they seem",
  ghosting_risk: "Likelihood of the conversation fading out",
  emotional_warmth: "Affection and care in the conversation",
  humor_playfulness: "Jokes, banter, and lightness",
  conversation_balance: "Equal effort from both sides",
  toxicity_level: "Presence of harmful or hostile patterns",
  romantic_tension: "Flirty or romantic energy",
  friendship_depth: "Depth of personal connection",
};

function renderResults(data) {
  const { scores, nature, nature_tags, summary, tone_shift, green_flags, red_flags, verdict, stats } = data;

  // Nature badge
  const badge = $("nature-badge");
  const theme = natureColors[nature] || { bg: "#25d36622", color: "#25d366", border: "#25d366" };
  badge.textContent = nature;
  badge.style.background = theme.bg;
  badge.style.color = theme.color;
  badge.style.border = `1px solid ${theme.border}`;

  // Nature tags
  const tagsEl = $("nature-tags");
  tagsEl.innerHTML = (nature_tags || []).map(t => `<span class="nature-tag">${escapeHtml(t)}</span>`).join("");

  // Verdict
  $("verdict-box").textContent = verdict || "";

  // Stats
  if (stats) {
    $("stat-total").textContent = stats.totalMessages ?? "-";
    $("stat-them").textContent = stats.theirCount ?? "-";
    $("stat-you").textContent = stats.yourCount ?? "-";
    $("stat-rt-trend").textContent = formatTrend(stats.responseTimeTrend);
  }

  // Score rings
  const grid = $("scores-grid");
  grid.innerHTML = "";
  const circumference = 2 * Math.PI * 27;

  Object.entries(scoreConfig).forEach(([key, cfg]) => {
    const value = scores?.[key] ?? 0;
    const offset = circumference - (value / 100) * circumference;

    const card = document.createElement("div");
    card.className = "score-card";
    card.innerHTML = `
      <div class="score-ring">
        <svg viewBox="0 0 64 64">
          <circle class="track" cx="32" cy="32" r="27" />
          <circle class="fill" cx="32" cy="32" r="27"
            stroke="${cfg.color}"
            stroke-dasharray="${circumference}"
            stroke-dashoffset="${circumference}"
            data-offset="${offset}" />
        </svg>
        <div class="value" style="color:${cfg.color}">${value}</div>
      </div>
      <div class="score-info">
        <div class="score-name">${cfg.label}</div>
        <div class="score-desc">${scoreDescriptions[key]}</div>
      </div>
    `;
    grid.appendChild(card);
  });

  // Animate rings after paint
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      grid.querySelectorAll(".fill").forEach(circle => {
        circle.style.strokeDashoffset = circle.dataset.offset;
      });
    });
  });

  // Summary & tone shift
  $("summary-text").textContent = summary || "";
  $("tone-shift-text").textContent = tone_shift || "";

  // Flags
  const greenList = $("green-flags");
  const redList = $("red-flags");
  greenList.innerHTML = (green_flags || []).map(f => `<li>${escapeHtml(f)}</li>`).join("");
  redList.innerHTML = (red_flags || []).map(f => `<li>${escapeHtml(f)}</li>`).join("");

  // Show results section
  $("results").classList.remove("hidden");
  $("results").scrollIntoView({ behavior: "smooth", block: "start" });
}

function formatTrend(trend) {
  if (!trend) return "-";
  if (trend === "improving") return "Getting Faster";
  if (trend === "slowing") return "Slowing Down";
  return "Steady";
}

// --- Reset ---
$("btn-reset").addEventListener("click", () => {
  $("results").classList.add("hidden");
  selectedFile = null;
  $("file-name").textContent = "";
  $("export-text").value = "";
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// --- Helpers ---
function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Connect WS on load to catch server-pushed events
connectWS();
