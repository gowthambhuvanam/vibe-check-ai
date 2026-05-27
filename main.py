#!/usr/bin/env python3
"""
Ghosting Probability Predictor
Analyzes chat conversations and predicts the probability of being ghosted.

Usage:
  Streamlit UI:  streamlit run app.py
  CLI:           python main.py --file conversation.txt
                 python main.py --text "paste conversation here"
"""

import os
import sys
import json
import argparse
from dotenv import load_dotenv
from src.analyzer import analyze_conversation

load_dotenv()


def parse_args():
    parser = argparse.ArgumentParser(description="Ghosting Probability Predictor")
    parser.add_argument("--file", help="Path to a text file containing the conversation")
    parser.add_argument("--text", help="Conversation text directly as a string")
    parser.add_argument("--name", default="You", help="Your name as it appears in the chat (default: You)")
    parser.add_argument("--json", action="store_true", help="Output raw JSON result")
    return parser.parse_args()


def print_result(result: dict):
    probability = result.get("ghosting_probability", 0)
    verdict = result.get("verdict", "Unknown")
    confidence = result.get("confidence", "low")

    print("\n" + "=" * 50)
    print(f"Ghosting Probability: {probability}%")
    print(f"Verdict: {verdict}")
    print(f"Confidence: {confidence}")
    print("=" * 50)

    print(f"\nMessages analyzed: {result.get('message_count', 0)}")
    print(f"Their messages: {result.get('their_count', 0)}")
    print(f"Your messages: {result.get('your_count', 0)}")

    tone = result.get("tone_shift", "")
    if tone:
        print(f"\nTone shift: {tone}")

    what_changed = result.get("what_changed", "")
    if what_changed:
        print(f"\nWhat changed:\n{what_changed}")

    signals = result.get("signals_detected", [])
    if signals:
        print("\nSignals detected:")
        for s in signals:
            direction = s.get("direction", "neutral")
            prefix = "[+]" if direction == "positive" else "[-]" if direction == "negative" else "[~]"
            print(f"  {prefix} {s.get('signal', '')} ({s.get('weight', '')} weight)")
            print(f"      {s.get('explanation', '')}")

    red_flags = result.get("red_flags", [])
    if red_flags:
        print("\nRed flags:")
        for f in red_flags:
            print(f"  - {f}")

    positives = result.get("positive_signs", [])
    if positives:
        print("\nPositive signs:")
        for p in positives:
            print(f"  - {p}")

    recommendation = result.get("recommendation", "")
    if recommendation:
        print(f"\nRecommendation:\n{recommendation}")
    print()


def main():
    args = parse_args()

    if not os.environ.get("LLM_API_KEY"):
        print("Error: LLM_API_KEY environment variable not set")
        sys.exit(1)
    if not os.environ.get("LLM_MODEL"):
        print("Error: LLM_MODEL environment variable not set")
        sys.exit(1)

    if args.file:
        with open(args.file, "r", encoding="utf-8") as f:
            text = f.read()
    elif args.text:
        text = args.text
    else:
        print("Paste your conversation below. Press Ctrl+D (or Ctrl+Z on Windows) when done:\n")
        text = sys.stdin.read()

    print("Analyzing conversation...")
    result = analyze_conversation(text, args.name)

    if "error" in result:
        print(f"Error: {result['error']}")
        sys.exit(1)

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print_result(result)


if __name__ == "__main__":
    main()
