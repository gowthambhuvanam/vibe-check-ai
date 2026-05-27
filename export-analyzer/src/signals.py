from dataclasses import dataclass, field
from typing import List, Optional
from src.parser import Message


@dataclass
class ConversationSignals:
    total_messages: int = 0
    their_message_count: int = 0
    your_message_count: int = 0

    avg_response_time_early: Optional[float] = None
    avg_response_time_late: Optional[float] = None
    response_time_trend: str = "unknown"
    response_time_change_pct: Optional[float] = None

    avg_length_early: float = 0
    avg_length_late: float = 0
    length_trend: str = "unknown"
    length_change_pct: float = 0

    their_initiation_count: int = 0
    your_initiation_count: int = 0
    initiation_ratio: float = 0.5

    their_question_count: int = 0
    question_ratio: float = 0

    max_consecutive_your_messages: int = 0
    last_sender: str = "unknown"

    conversation_excerpt_early: str = ""
    conversation_excerpt_late: str = ""


def extract_signals(messages: List[Message]) -> ConversationSignals:
    if not messages:
        return ConversationSignals()

    their_msgs = [m for m in messages if m.sender == "them"]
    your_msgs = [m for m in messages if m.sender == "you"]

    signals = ConversationSignals(
        total_messages=len(messages),
        their_message_count=len(their_msgs),
        your_message_count=len(your_msgs)
    )

    # Response time trend: compare first half vs second half of their responses
    their_response_times = [
        m.response_time_minutes for m in messages
        if m.sender == "them" and m.response_time_minutes is not None
    ]

    if len(their_response_times) >= 4:
        mid = len(their_response_times) // 2
        early_times = their_response_times[:mid]
        late_times = their_response_times[mid:]
        signals.avg_response_time_early = sum(early_times) / len(early_times)
        signals.avg_response_time_late = sum(late_times) / len(late_times)

        if signals.avg_response_time_early > 0:
            change = (signals.avg_response_time_late - signals.avg_response_time_early) / signals.avg_response_time_early
            signals.response_time_change_pct = round(change * 100, 1)
            if change > 0.3:
                signals.response_time_trend = "declining"
            elif change < -0.3:
                signals.response_time_trend = "improving"
            else:
                signals.response_time_trend = "stable"

    # Message length trend
    def avg_words(msg_list):
        if not msg_list:
            return 0
        return sum(len(m.content.split()) for m in msg_list) / len(msg_list)

    mid_idx = len(their_msgs) // 2
    if mid_idx > 0:
        early_msgs = their_msgs[:mid_idx]
        late_msgs = their_msgs[mid_idx:]
        signals.avg_length_early = round(avg_words(early_msgs), 1)
        signals.avg_length_late = round(avg_words(late_msgs), 1)

        if signals.avg_length_early > 0:
            change = (signals.avg_length_late - signals.avg_length_early) / signals.avg_length_early
            signals.length_change_pct = round(change * 100, 1)
            if change < -0.25:
                signals.length_trend = "declining"
            elif change > 0.25:
                signals.length_trend = "improving"
            else:
                signals.length_trend = "stable"

    # Initiation ratio
    initiations_them = 0
    initiations_you = 0
    for i, msg in enumerate(messages):
        if i == 0:
            if msg.sender == "them":
                initiations_them += 1
            else:
                initiations_you += 1
        elif messages[i - 1].sender != msg.sender:
            if msg.response_time_minutes and msg.response_time_minutes > 60:
                if msg.sender == "them":
                    initiations_them += 1
                else:
                    initiations_you += 1

    signals.their_initiation_count = initiations_them
    signals.your_initiation_count = initiations_you
    total_initiations = initiations_them + initiations_you
    if total_initiations > 0:
        signals.initiation_ratio = round(initiations_them / total_initiations, 2)

    # Question ratio
    question_count = sum(1 for m in their_msgs if "?" in m.content)
    signals.their_question_count = question_count
    if their_msgs:
        signals.question_ratio = round(question_count / len(their_msgs), 2)

    # Consecutive your messages without reply
    max_streak = 0
    current_streak = 0
    for msg in messages:
        if msg.sender == "you":
            current_streak += 1
            max_streak = max(max_streak, current_streak)
        else:
            current_streak = 0
    signals.max_consecutive_your_messages = max_streak

    # Last sender
    if messages:
        signals.last_sender = messages[-1].sender

    # Conversation excerpts for LLM context
    def msgs_to_text(msg_list):
        return "\n".join(f"[{m.sender.upper()}]: {m.content}" for m in msg_list)

    early_slice = messages[:min(8, len(messages) // 2 + 1)]
    late_slice = messages[max(0, len(messages) - 8):]
    signals.conversation_excerpt_early = msgs_to_text(early_slice)
    signals.conversation_excerpt_late = msgs_to_text(late_slice)

    return signals
