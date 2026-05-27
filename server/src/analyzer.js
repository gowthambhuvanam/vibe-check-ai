"use strict";

const OpenAI = require("openai");

let client = null;
let model = null;

function initLLM() {
  if (client) return;
  const apiKey = process.env.LLM_API_KEY;
  const baseURL = process.env.LLM_BASE_URL;
  model = process.env.LLM_MODEL;
  if (!apiKey || !model) throw new Error("LLM_API_KEY and LLM_MODEL are required in .env");
  client = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
}

async function analyzeConversation(signalsSummary, excerptEarly, excerptLate) {
  initLLM();

  const prompt = `You are an expert conversation analyst. Analyze this chat conversation data and return a JSON analysis across 8 dimensions.

QUANTITATIVE SIGNALS:
${signalsSummary}

EARLY CONVERSATION SAMPLE (how it started):
${excerptEarly}

RECENT CONVERSATION SAMPLE (how it is now):
${excerptLate}

Return ONLY a JSON object with exactly this structure:
{
  "scores": {
    "interest_level": <0-100>,
    "ghosting_risk": <0-100>,
    "emotional_warmth": <0-100>,
    "humor_playfulness": <0-100>,
    "conversation_balance": <0-100>,
    "toxicity_level": <0-100>,
    "romantic_tension": <0-100>,
    "friendship_depth": <0-100>
  },
  "nature": "<one label: Casual | Romantic | Toxic | Playful | Fading | One-sided | Loving | Deep | Complicated | Distant | Obsessive | Warm | Friendly | Flirty>",
  "nature_tags": ["tag1", "tag2", "tag3"],
  "summary": "<2-3 sentence honest summary of what this conversation actually is>",
  "tone_shift": "<how the tone changed from early to recent, one sentence>",
  "green_flags": ["positive signal 1", "positive signal 2"],
  "red_flags": ["concerning signal 1", "concerning signal 2"],
  "verdict": "<one punchy honest sentence about the state of this conversation>"
}

Scoring guide:
- interest_level: 100 = they are very engaged and curious, 0 = completely checked out
- ghosting_risk: 100 = almost certain to ghost, 0 = zero risk
- emotional_warmth: 100 = very affectionate and caring, 0 = cold and transactional
- humor_playfulness: 100 = constant jokes and banter, 0 = no lightness at all
- conversation_balance: 100 = perfectly equal effort, 0 = completely one-sided
- toxicity_level: 100 = highly toxic, manipulative or hostile, 0 = healthy
- romantic_tension: 100 = clearly romantic or flirty, 0 = purely platonic
- friendship_depth: 100 = deep personal connection, 0 = surface level only

Be direct. Base everything on actual evidence. Return ONLY the JSON, nothing else.`;

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: "You are a conversation analyst. Return only valid JSON." },
      { role: "user", content: prompt }
    ],
    temperature: 0.2,
    max_tokens: 1500,
  });

  let content = response.choices[0].message.content.trim();
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/(\{[\s\S]*\})/);
  if (jsonMatch) content = jsonMatch[1];

  return JSON.parse(content);
}

module.exports = { analyzeConversation };
