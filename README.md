# WhatsApp Chat Analyzer

Analyzes any WhatsApp conversation across 8 behavioral dimensions and gives it an honest verdict. Connects directly to WhatsApp via QR code scan for real-time analysis, or accepts an exported chat file. Runs as a web app in your browser with visual score rings, trend indicators, and a full breakdown.

---

## What It Does

Most people can sense when a conversation is shifting, but reading it objectively is hard when you are involved in it. This tool extracts quantitative signals from the message history - response time trends, initiation ratios, message length changes, question frequency - then feeds them to an AI that scores the conversation across 8 dimensions and delivers a direct summary of what is actually happening.

---

## Real Output

The following is real output from analyzing a conversation that started warm and became one-sided over time:

```
Nature: Fading

Verdict: Interest is dropping fast. They are still responding but putting in
         noticeably less effort than they were two weeks ago.

Total Messages: 62    Their Messages: 31    Your Messages: 31
Response Trend: Slowing Down

Scores:
  Interest Level        28   Ghosting Risk         74
  Emotional Warmth      35   Humor / Playfulness   20
  Conversation Balance  42   Toxicity Level         5
  Romantic Tension      15   Friendship Depth      40

Summary:
The conversation started with genuine mutual interest and frequent back-and-forth,
but has shifted noticeably over the last two weeks. Their messages are now shorter,
less frequent, and rarely include questions. You are doing most of the initiation.

Tone Shift:
Early messages were warm and playful with frequent questions from both sides.
Recent messages are brief, reactive, and lack personal engagement.

Green Flags:
  + They still respond consistently
  + No hostility or negative patterns

Red Flags:
  - Response time increased 340% from early to recent period
  - Message length dropped from 14 words average to 5 words average
  - Questions dropped from 60% of their messages to 8%
  - You initiated 8 of the last 10 conversations
```

---

## 8 Dimensions Scored

| Dimension | What It Measures |
|-----------|-----------------|
| Interest Level | How engaged and curious they seem |
| Ghosting Risk | Likelihood the conversation fades out |
| Emotional Warmth | Affection and care in the conversation |
| Humor and Playfulness | Jokes, banter, and lightness |
| Conversation Balance | Whether effort is equal from both sides |
| Toxicity Level | Presence of harmful or hostile patterns |
| Romantic Tension | Flirty or romantic energy |
| Friendship Depth | Depth of personal connection |

---

## Two Modes

### QR Code - Real-Time

Connects to your WhatsApp the same way WhatsApp Web does. Scan the QR code with your phone, pick any conversation from the list, and get the analysis in seconds. No data leaves your machine.

### Export File

Export any chat from WhatsApp (Chat, three dots, More, Export Chat, without media). Upload the .txt file or paste the text directly.

---

## Setup

Requires Node.js 18 or later.

```bash
git clone https://github.com/gowthambhuvanam/whatsapp-chat-analyzer
cd whatsapp-chat-analyzer/server
npm install
cp .env.example .env
```

Edit `.env` with your LLM provider credentials:

```env
# NVIDIA NIM
LLM_API_KEY=nvapi-...
LLM_BASE_URL=https://integrate.api.nvidia.com/v1
LLM_MODEL=meta/llama-4-maverick-17b-128e-instruct

# OpenAI
LLM_API_KEY=sk-...
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o

# Groq
LLM_API_KEY=gsk_...
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_MODEL=llama-3.3-70b-versatile
```

Works with any OpenAI-compatible API.

```bash
node index.js
```

Open http://localhost:3000 in your browser.

---

## How QR Mode Works

The server runs a headless Chromium instance via Puppeteer using the `whatsapp-web.js` library, which implements the WhatsApp Web protocol. When you click Connect, the server generates a QR code that your phone scans to authenticate. Once connected, it reads your chat history directly from WhatsApp's servers. The connection uses the same mechanism as WhatsApp Web and your session is stored locally.

Your messages are never sent to any third-party service except the LLM API you configure in `.env`, and only the signal summary (not the actual message content) is sent for analysis.

---

## Signals Extracted

| Signal | How It Is Computed |
|--------|-------------------|
| Response time trend | Average response time in early half vs recent half |
| Message length trend | Average word count, early vs recent messages |
| Initiation ratio | Who starts new conversation threads after long gaps |
| Question frequency | Percentage of their messages containing a question |
| Consecutive messages | Maximum times you sent without getting a reply |
| Message ratio | Their total message count vs yours |

---

## Project Structure

```
whatsapp-chat-analyzer/
  server/
    index.js              Express + WebSocket server, API routes
    src/
      whatsapp.js         WhatsApp Web client, QR flow, message fetching
      signals.js          Quantitative signal extraction and export parser
      analyzer.js         LLM client, prompt construction, JSON parsing
    .env.example
  client/
    index.html            Single-page web app
    style.css             Dark theme, score rings, responsive layout
    app.js                WebSocket client, UI logic, SVG ring animation
```

---

## What Works and What Does Not

The QR mode works the same as WhatsApp Web. If WhatsApp Web works on your computer, this works. The analysis quality depends on the LLM you configure. Llama 4 Maverick and GPT-4o both produce strong results. The export parser supports the standard WhatsApp .txt export format and a simple `Name: message` format with optional time annotations.

Groups are excluded from the chat list because the signals are designed for two-person conversations.

---

## LLM Provider Compatibility

Tested with NVIDIA NIM (Llama 4 Maverick), OpenAI (GPT-4o, GPT-4o mini), Groq (Llama 3.3 70B), and Anthropic Claude via a compatible proxy. The client is built on the `openai` Node.js SDK and works with any provider that offers an OpenAI-compatible chat completions endpoint.
