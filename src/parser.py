import re
from dataclasses import dataclass
from typing import List, Optional
from datetime import datetime


@dataclass
class Message:
    sender: str
    content: str
    timestamp: Optional[datetime] = None
    response_time_minutes: Optional[float] = None


def parse_whatsapp(text: str, your_name: str) -> List[Message]:
    """
    Parses WhatsApp exported chat format.
    Example line: 12/25/23, 10:30 AM - John: Hey how are you?
    """
    pattern = r"(\d{1,2}/\d{1,2}/\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)\s*[-:]\s*([^:]+):\s*(.+)"
    messages = []

    for line in text.strip().split("\n"):
        match = re.match(pattern, line.strip())
        if not match:
            continue

        date_str, time_str, sender, content = match.groups()
        sender = sender.strip()
        normalized_sender = "you" if sender.lower() == your_name.lower() else "them"

        try:
            dt = datetime.strptime(f"{date_str} {time_str.strip()}", "%m/%d/%y %I:%M %p")
        except ValueError:
            try:
                dt = datetime.strptime(f"{date_str} {time_str.strip()}", "%d/%m/%y %H:%M")
            except ValueError:
                dt = None

        messages.append(Message(sender=normalized_sender, content=content.strip(), timestamp=dt))

    _compute_response_times(messages)
    return messages


def parse_simple(text: str, your_name: str) -> List[Message]:
    """
    Parses simple format:
    [You]: message
    [Them]: message
    or
    You: message
    Them: message

    Optional response time annotation:
    [Them - 3 hours]: message
    [Them - 20 min]: message
    """
    messages = []
    pattern = r"^\[?([^\]\-:]+?)(?:\s*-\s*([\d\.]+\s*(?:min|mins|hour|hours|hr|hrs|day|days)))?\]?\s*:\s*(.+)$"

    for line in text.strip().split("\n"):
        line = line.strip()
        if not line:
            continue

        match = re.match(pattern, line, re.IGNORECASE)
        if not match:
            continue

        sender_raw, time_hint, content = match.groups()
        sender_raw = sender_raw.strip()
        normalized_sender = "you" if sender_raw.lower() in [your_name.lower(), "you", "me"] else "them"

        response_time = None
        if time_hint:
            num = float(re.search(r"[\d\.]+", time_hint).group())
            if any(x in time_hint.lower() for x in ["hour", "hr"]):
                response_time = num * 60
            elif any(x in time_hint.lower() for x in ["day"]):
                response_time = num * 60 * 24
            else:
                response_time = num

        messages.append(Message(
            sender=normalized_sender,
            content=content.strip(),
            response_time_minutes=response_time
        ))

    return messages


def parse_auto(text: str, your_name: str) -> List[Message]:
    """Auto-detects format and parses accordingly."""
    if re.search(r"\d{1,2}/\d{1,2}/\d{2,4},?\s+\d{1,2}:\d{2}", text):
        return parse_whatsapp(text, your_name)
    return parse_simple(text, your_name)


def _compute_response_times(messages: List[Message]):
    """Fills in response_time_minutes from timestamps where available."""
    for i in range(1, len(messages)):
        prev = messages[i - 1]
        curr = messages[i]
        if (curr.sender != prev.sender
                and curr.timestamp is not None
                and prev.timestamp is not None):
            delta = (curr.timestamp - prev.timestamp).total_seconds() / 60
            if delta >= 0:
                curr.response_time_minutes = delta
