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

const relationshipContexts = {
  "close-friend": {
    label: "Close Friend",
    context: `This is an established close friendship. These two people already have a deep real-world bond.
Key adjustments:
- Low message frequency is NORMAL and does NOT indicate low interest or ghosting risk. Close friends often go days or weeks without texting and that is healthy.
- Ghosting risk should only be high if there are active signs of avoidance or hostility.
- Friendship depth should reflect the established closeness, not just chat frequency.
- Focus your analysis on the quality and warmth of messages when they do talk, not on how often they text.
- Do NOT penalize for short chats or infrequent contact.`,
  },
  "romantic": {
    label: "Romantic Interest",
    context: `This is a romantic or dating context. Both people are potentially interested in each other romantically.
Key adjustments:
- Response time and frequency matter more here. Delays and short replies are meaningful signals.
- Look carefully for signs of interest, tension, and reciprocity.
- Romantic tension and emotional warmth scores are the most important dimensions.
- One-sided effort is a significant red flag in this context.
- Ghosting risk is highly relevant and should be assessed carefully.`,
  },
  "new-connection": {
    label: "New Connection",
    context: `This is an early-stage relationship. These people recently met or just started talking.
Key adjustments:
- Effort and engagement signals matter a lot since the relationship is still forming.
- Low frequency or short replies early on can indicate low interest.
- Look for signs of curiosity, questions asked, and genuine engagement.
- Ghosting risk is relevant since new connections fade easily.
- Friendship depth and emotional warmth are naturally lower at this stage, so do not penalize unless the conversation is unusually cold.`,
  },
  "colleague": {
    label: "Colleague / Classmate",
    context: `This is a professional or academic relationship. The context is work or school.
Key adjustments:
- Transactional and task-focused messages are NORMAL and not a sign of coldness.
- Emotional warmth, romantic tension, and friendship depth will naturally be lower.
- Low humor is expected in professional chats.
- Ghosting risk is much less relevant in professional contexts.
- Focus on whether the communication is respectful, collaborative, and functional.
- Do not flag professional distance as a red flag.`,
  },
  "family": {
    label: "Family",
    context: `This is a family relationship. The context is familial communication.
Key adjustments:
- Infrequent texting is completely normal in family relationships.
- Messages may be functional, brief, or checking-in type.
- Emotional warmth should be assessed based on care signals, not just affectionate language.
- Romantic tension is irrelevant and should score 0.
- Ghosting risk is very low unless there are clear signs of estrangement.
- Family relationships have their own unique dynamic that does not follow the same patterns as friendships or romantic relationships.`,
  },
};

async function analyzeConversation(signalsSummary, excerptEarly, excerptLate, relationshipType = "close-friend") {
  initLLM();

  const relContext = relationshipContexts[relationshipType] || relationshipContexts["close-friend"];

  const prompt = `You are an expert conversation analyst. Analyze this chat conversation data and return a JSON analysis across 8 dimensions.

RELATIONSHIP TYPE: ${relContext.label}

RELATIONSHIP CONTEXT (critical - adjust your entire analysis based on this):
${relContext.context}

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
  "summary": "<2-3 sentence honest summary of what this conversation actually is, written with the relationship context in mind>",
  "tone_shift": "<how the tone changed from early to recent, one sentence>",
  "green_flags": ["positive signal 1", "positive signal 2"],
  "red_flags": ["concerning signal 1", "concerning signal 2"],
  "verdict": "<one punchy honest sentence about the state of this conversation, appropriate for the relationship type>"
}

Base scoring guide (adjust based on relationship context above):
- interest_level: 100 = very engaged and curious, 0 = completely checked out
- ghosting_risk: 100 = almost certain to ghost, 0 = zero risk
- emotional_warmth: 100 = very affectionate and caring, 0 = cold and transactional
- humor_playfulness: 100 = constant jokes and banter, 0 = no lightness at all
- conversation_balance: 100 = perfectly equal effort, 0 = completely one-sided
- toxicity_level: 100 = highly toxic, manipulative or hostile, 0 = healthy
- romantic_tension: 100 = clearly romantic or flirty, 0 = purely platonic
- friendship_depth: 100 = deep personal connection, 0 = surface level only

Be direct and honest. Apply the relationship context strictly. Return ONLY the JSON, nothing else.`;

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
