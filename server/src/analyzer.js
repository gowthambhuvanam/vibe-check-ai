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

const relHints = {
  "close-friend":   "Close friends often text infrequently - low frequency is normal, not a ghost signal. Judge by warmth and quality when they do talk.",
  "romantic":       "Romantic context - response time, effort, and reciprocity matter a lot. One-sided effort and slow replies are significant red flags.",
  "new-connection": "New connection - engagement and curiosity signals matter most. Low effort early on is a real warning sign.",
  "colleague":      "Professional context - transactional messages and low emotional warmth are completely normal. Do not flag professional distance.",
  "family":         "Family relationship - infrequent contact is normal, ghosting risk is almost always low, romantic tension must be 0.",
};

async function analyzeConversation(signalsSummary, excerptEarly, excerptLate, relationshipType = "close-friend") {
  initLLM();

  const hint = relHints[relationshipType] || relHints["close-friend"];

  const prompt = `You are an expert conversation analyst. Analyze this chat and return a JSON analysis.

RELATIONSHIP CONTEXT: ${hint}

QUANTITATIVE SIGNALS:
${signalsSummary}

EARLY CONVERSATION SAMPLE:
${excerptEarly}

RECENT CONVERSATION SAMPLE:
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
  "nature": "<Casual | Romantic | Toxic | Playful | Fading | One-sided | Loving | Deep | Complicated | Distant | Obsessive | Warm | Friendly | Flirty>",
  "nature_tags": ["tag1", "tag2", "tag3"],
  "summary": "<2-3 sentence honest summary>",
  "tone_shift": "<how tone changed from early to recent, one sentence>",
  "green_flags": ["signal 1", "signal 2"],
  "red_flags": ["signal 1", "signal 2"],
  "verdict": "<one punchy honest sentence>"
}

Scoring rules - be decisive, use the full 0-100 range, do NOT cluster around 40-60:
- interest_level: 85+ = very engaged with questions and energy. 15 or below = barely responding, one-word replies. 50 = neutral.
- ghosting_risk: 80+ = clear signs of fading (no questions, long delays, shrinking replies). 10 or below = actively engaged, no drop-off. Adjust heavily based on relationship context.
- emotional_warmth: 80+ = affectionate language, care shown. 10 or below = cold and purely transactional.
- humor_playfulness: 80+ = frequent jokes and banter. 5 or below = zero humor. Most work chats score under 20.
- conversation_balance: 80+ = both putting in equal effort. 20 or below = heavily one-sided. 50 = moderate imbalance.
- toxicity_level: only score above 50 if there are actual hostile, manipulative, or harmful patterns. Most chats score under 20.
- romantic_tension: only score above 40 if there is clear flirty or romantic language. Platonic chats should score under 15.
- friendship_depth: 80+ = personal topics, vulnerability, genuine care. 15 or below = surface level only.

Base all scores on real evidence from the signals and excerpts. Apply the relationship context. Return ONLY the JSON.`;

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: "You are a conversation analyst. Return only valid JSON." },
      { role: "user", content: prompt }
    ],
    temperature: 0.2,
    max_tokens: 1200,
  });

  let content = response.choices[0].message.content.trim();
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/(\{[\s\S]*\})/);
  if (jsonMatch) content = jsonMatch[1];

  return JSON.parse(content);
}

module.exports = { analyzeConversation };
