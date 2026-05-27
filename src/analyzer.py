from src.parser import parse_auto
from src.signals import extract_signals
from src.llm_client import LLMClient


def build_signals_summary(signals) -> str:
    lines = [
        f"Total messages: {signals.total_messages}",
        f"Their messages: {signals.their_message_count} | Your messages: {signals.your_message_count}",
        f"Message ratio (them/you): {round(signals.their_message_count / max(signals.your_message_count, 1), 2)}",
    ]

    if signals.avg_response_time_early is not None:
        lines.append(f"Their avg response time - Early: {round(signals.avg_response_time_early, 1)} min | Recent: {round(signals.avg_response_time_late, 1)} min")
        lines.append(f"Response time trend: {signals.response_time_trend} ({signals.response_time_change_pct:+.1f}%)")
    else:
        lines.append("Response time data: not available (no timestamps in input)")

    lines += [
        f"Their message length - Early: {signals.avg_length_early} words | Recent: {signals.avg_length_late} words",
        f"Message length trend: {signals.length_trend} ({signals.length_change_pct:+.1f}%)",
        f"Conversation initiations - Them: {signals.their_initiation_count} | You: {signals.your_initiation_count}",
        f"Their initiation ratio: {signals.initiation_ratio} (0=never, 1=always initiates)",
        f"Questions asked by them: {signals.their_question_count} ({round(signals.question_ratio * 100)}% of their messages)",
        f"Max consecutive messages sent by you without reply: {signals.max_consecutive_your_messages}",
        f"Last message sent by: {signals.last_sender}",
    ]
    return "\n".join(lines)


def analyze_conversation(text: str, your_name: str = "You") -> dict:
    messages = parse_auto(text, your_name)

    if len(messages) < 4:
        return {
            "error": "Not enough messages to analyze. Paste at least 4 messages of back-and-forth conversation."
        }

    signals = extract_signals(messages)
    signals_summary = build_signals_summary(signals)

    llm = LLMClient()
    result = llm.analyze(signals_summary, signals.conversation_excerpt_early, signals.conversation_excerpt_late)

    result["signals_summary"] = signals_summary
    result["message_count"] = signals.total_messages
    result["their_count"] = signals.their_message_count
    result["your_count"] = signals.your_message_count

    return result
