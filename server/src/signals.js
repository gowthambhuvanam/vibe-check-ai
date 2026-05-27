"use strict";

function extractSignals(messages, yourName) {
  const yours = messages.filter(m => m.sender === "you");
  const theirs = messages.filter(m => m.sender === "them");

  const result = {
    totalMessages: messages.length,
    theirCount: theirs.length,
    yourCount: yours.length,
    messageRatio: theirs.length / Math.max(yours.length, 1),
    avgResponseTimeEarly: null,
    avgResponseTimeLate: null,
    responseTimeTrend: "unknown",
    responseTimeChangePct: null,
    avgLengthEarly: 0,
    avgLengthLate: 0,
    lengthTrend: "unknown",
    lengthChangePct: 0,
    theirInitiations: 0,
    yourInitiations: 0,
    initiationRatio: 0,
    questionRatio: 0,
    maxConsecutiveYours: 0,
    lastSender: "unknown",
    excerptEarly: "",
    excerptLate: "",
  };

  // Response time trend from timestamps
  const theirResponseTimes = messages
    .filter(m => m.sender === "them" && m.responseTimeMinutes != null)
    .map(m => m.responseTimeMinutes);

  if (theirResponseTimes.length >= 4) {
    const mid = Math.floor(theirResponseTimes.length / 2);
    const early = theirResponseTimes.slice(0, mid);
    const late = theirResponseTimes.slice(mid);
    result.avgResponseTimeEarly = early.reduce((a, b) => a + b, 0) / early.length;
    result.avgResponseTimeLate = late.reduce((a, b) => a + b, 0) / late.length;
    if (result.avgResponseTimeEarly > 0) {
      const change = (result.avgResponseTimeLate - result.avgResponseTimeEarly) / result.avgResponseTimeEarly;
      result.responseTimeChangePct = Math.round(change * 100);
      result.responseTimeTrend = change > 0.3 ? "declining" : change < -0.3 ? "improving" : "stable";
    }
  }

  // Message length trend
  function avgWords(list) {
    if (!list.length) return 0;
    return list.reduce((sum, m) => sum + m.content.split(/\s+/).length, 0) / list.length;
  }

  const mid = Math.floor(theirs.length / 2);
  if (mid > 0) {
    result.avgLengthEarly = Math.round(avgWords(theirs.slice(0, mid)) * 10) / 10;
    result.avgLengthLate = Math.round(avgWords(theirs.slice(mid)) * 10) / 10;
    if (result.avgLengthEarly > 0) {
      const change = (result.avgLengthLate - result.avgLengthEarly) / result.avgLengthEarly;
      result.lengthChangePct = Math.round(change * 100);
      result.lengthTrend = change < -0.25 ? "declining" : change > 0.25 ? "improving" : "stable";
    }
  }

  // Initiation ratio
  for (let i = 0; i < messages.length; i++) {
    const isNew = i === 0 || (messages[i].responseTimeMinutes && messages[i].responseTimeMinutes > 120 && messages[i].sender !== messages[i - 1].sender);
    if (isNew) {
      if (messages[i].sender === "them") result.theirInitiations++;
      else result.yourInitiations++;
    }
  }
  const totalInit = result.theirInitiations + result.yourInitiations;
  result.initiationRatio = totalInit > 0 ? Math.round((result.theirInitiations / totalInit) * 100) / 100 : 0;

  // Question ratio
  const questionsAsked = theirs.filter(m => m.content.includes("?")).length;
  result.questionRatio = theirs.length > 0 ? Math.round((questionsAsked / theirs.length) * 100) / 100 : 0;

  // Max consecutive your messages
  let streak = 0, maxStreak = 0;
  for (const m of messages) {
    if (m.sender === "you") { streak++; maxStreak = Math.max(maxStreak, streak); }
    else streak = 0;
  }
  result.maxConsecutiveYours = maxStreak;

  // Last sender
  result.lastSender = messages[messages.length - 1]?.sender || "unknown";

  // Excerpts
  const toText = list => list.map(m => `[${m.sender.toUpperCase()}]: ${m.content}`).join("\n");
  const halfIdx = Math.floor(messages.length / 2);
  result.excerptEarly = toText(messages.slice(0, Math.min(8, halfIdx + 1)));
  result.excerptLate = toText(messages.slice(Math.max(0, messages.length - 8)));

  return result;
}

function parseExportText(text, yourName = "You") {
  const messages = [];

  // WhatsApp export format: 12/25/23, 10:30 AM - Name: message
  const waPattern = /(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)\s*[-:]\s*([^:]+):\s*(.+)/;

  // Simple format: [You - 5 min]: message OR [You]: message
  const simplePattern = /^\[?([^\]\-:]+?)(?:\s*-\s*([\d\.]+\s*(?:min|mins|hour|hours|hr|hrs|day|days)))?\]?\s*:\s*(.+)$/i;

  const isWhatsApp = waPattern.test(text.split("\n")[0]);

  for (const line of text.trim().split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (isWhatsApp) {
      const m = trimmed.match(waPattern);
      if (!m) continue;
      const [, , , senderRaw, content] = m;
      const sender = senderRaw.trim().toLowerCase() === yourName.toLowerCase() ? "you" : "them";
      messages.push({ sender, content: content.trim(), responseTimeMinutes: null });
    } else {
      const m = trimmed.match(simplePattern);
      if (!m) continue;
      const [, senderRaw, timeHint, content] = m;
      const sender = ["you", "me", yourName.toLowerCase()].includes(senderRaw.trim().toLowerCase()) ? "you" : "them";

      let responseTime = null;
      if (timeHint) {
        const num = parseFloat(timeHint.match(/[\d.]+/)[0]);
        if (/hour|hr/i.test(timeHint)) responseTime = num * 60;
        else if (/day/i.test(timeHint)) responseTime = num * 1440;
        else responseTime = num;
      }

      messages.push({ sender, content: content.trim(), responseTimeMinutes: responseTime });
    }
  }

  return messages;
}

function buildSummaryText(signals) {
  const lines = [
    `Total messages: ${signals.totalMessages}`,
    `Their messages: ${signals.theirCount} | Your messages: ${signals.yourCount}`,
    `Message ratio (them/you): ${Math.round(signals.messageRatio * 100) / 100}`,
  ];

  if (signals.avgResponseTimeEarly !== null) {
    lines.push(`Response time - Early: ${Math.round(signals.avgResponseTimeEarly)} min | Recent: ${Math.round(signals.avgResponseTimeLate)} min`);
    lines.push(`Response time trend: ${signals.responseTimeTrend} (${signals.responseTimeChangePct > 0 ? "+" : ""}${signals.responseTimeChangePct}%)`);
  } else {
    lines.push("Response time data: not available (no timestamps)");
  }

  lines.push(
    `Message length - Early: ${signals.avgLengthEarly} words | Recent: ${signals.avgLengthLate} words`,
    `Length trend: ${signals.lengthTrend} (${signals.lengthChangePct > 0 ? "+" : ""}${signals.lengthChangePct}%)`,
    `Initiations - Them: ${signals.theirInitiations} | You: ${signals.yourInitiations}`,
    `Their initiation ratio: ${signals.initiationRatio}`,
    `Questions asked by them: ${Math.round(signals.questionRatio * 100)}% of their messages`,
    `Max consecutive messages you sent without reply: ${signals.maxConsecutiveYours}`,
    `Last sender: ${signals.lastSender}`
  );

  return lines.join("\n");
}

module.exports = { extractSignals, parseExportText, buildSummaryText };
