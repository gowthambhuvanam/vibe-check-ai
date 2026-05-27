# Ghosting Probability Predictor

Analyzes chat conversations and predicts the probability of being ghosted. It detects behavioral shifts across response time patterns, message length trends, initiation ratio, and engagement signals, then runs an AI analysis to produce a probability score with specific evidence and a direct recommendation.

Works as a Streamlit web app or a CLI tool. Supports plain text format and WhatsApp chat exports.

---

## The Problem It Solves

Everyone has experienced a conversation that slowly dies and wondered whether the other person is losing interest or just busy. The signals are real but hard to see clearly when you are in the middle of it. Response times getting longer, messages getting shorter, questions stopping, one-word replies replacing paragraphs.

This tool reads those patterns objectively, quantifies them, and tells you exactly what changed and when.

---

## Real Output

The following is real output from analyzing a conversation that started well and gradually declined:

```
Ghosting Probability: 85%
Verdict: Already checked out
Confidence: high

Messages analyzed: 18
Their messages: 9 | Your messages: 9

Tone shift:
The tone changed from enthusiastic and engaged in early messages
to brief and unenthusiastic in recent messages.

What changed:
Their response time became significantly longer and their messages
became shorter and less engaging.

Signals detected:
  [-] Response time (high weight)
      Average response time increased 11,939% - from 15 minutes early on
      to 1,836 minutes (about 30 hours) in recent messages.

  [-] Message length (medium weight)
      Average message length declined 57.9% - from 9.5 words to 4.0 words.

  [~] Conversation initiation (low weight)
      They initiated 5 of 6 conversations, showing early interest.

  [-] Questions asked (medium weight)
      They asked zero questions across 9 messages, indicating no curiosity
      about continuing the connection.

Red flags:
  - Significant increase in response time
  - Decline in message length and engagement
  - No questions asked in any of their 9 messages

Positive signs:
  - They responded to all your messages

Recommendation:
It is likely they are losing interest. Consider not investing more time
and effort into this conversation. Move on and focus on other connections.
```

---

## Signals It Tracks

| Signal | How it is measured |
|--------|-------------------|
| Response time trend | Average response time in first half vs second half of conversation |
| Message length trend | Average word count per message, early vs recent |
| Initiation ratio | Who starts new conversation threads after long gaps |
| Question ratio | Percentage of their messages that contain a question |
| Consecutive messages | How many times you messaged without getting a reply |
| Tone shift | AI-detected change in enthusiasm and engagement between early and recent messages |

---

## Usage

### Streamlit web app

```bash
git clone https://github.com/gowthambhuvanam/ghosting-probability-predictor
cd ghosting-probability-predictor
pip install -r requirements.txt
cp .env.example .env
# fill in your LLM credentials in .env
streamlit run app.py
```

Open your browser at `http://localhost:8501`, paste a conversation, and click Analyze.

### CLI

```bash
python main.py --file conversation.txt
python main.py --text "[You]: Hey\n[Them - 3 days]: Oh hey"
python main.py --file chat.txt --json   # raw JSON output
```

---

## Conversation Format

Paste in this simple format:

```
[You]: Hey want to hang out this weekend?
[Them - 5 min]: Sure that sounds fun!
[You]: Saturday work?
[Them - 3 hours]: Maybe
[You]: Let me know
[Them - 2 days]: Yeah
```

The time annotations (5 min, 3 hours, 2 days) are optional but improve accuracy of the response time analysis.

WhatsApp exports are also supported. Export a chat from WhatsApp (without media), paste the full text, and the tool auto-detects the format.

---

## Setup

```bash
cp .env.example .env
```

Edit `.env` with your LLM provider credentials:

```
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

---

## Project Structure

```
ghosting-probability-predictor/
  src/
    parser.py       parse plain text and WhatsApp export formats
    signals.py      extract quantitative behavioral signals
    llm_client.py   provider-agnostic LLM client
    analyzer.py     orchestration - combines signals and LLM analysis
  app.py            Streamlit web interface
  main.py           CLI entry point
  requirements.txt
  .env.example
```
