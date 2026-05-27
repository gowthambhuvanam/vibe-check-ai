import os
import streamlit as st
from dotenv import load_dotenv
from src.analyzer import analyze_conversation  # run from export-analyzer/ directory

load_dotenv()

st.set_page_config(
    page_title="Ghosting Probability Predictor",
    layout="centered"
)

st.title("Ghosting Probability Predictor")
st.write("Paste a chat conversation and find out if you are about to get ghosted. The tool analyzes response time patterns, message length trends, initiation ratio, and engagement signals.")

SAMPLE_CONVERSATION = """[You]: Hey! Loved meeting you at the event. Want to grab coffee sometime?
[Them - 5 min]: Yes definitely! That would be great, I had so much fun talking to you
[You]: Same! How about this Saturday morning?
[Them - 8 min]: Saturday works perfectly! Let us do 10am at that cafe near downtown
[You]: Perfect, see you then!
[Them - 3 min]: Cannot wait, it is going to be fun

[You]: Hey, running 5 min late, just parking
[Them - 2 min]: No worries, I just got here too

[You]: That was so fun, we should do this again soon
[Them - 45 min]: Yeah it was nice
[You]: I know a great place for dinner next week, interested?
[Them - 3 hours]: Maybe, let me check my schedule
[You]: No pressure, just let me know
[Them - 1 day]: Yeah I have been pretty busy lately

[You]: Hope your week is going well
[Them - 6 hours]: Thanks
[You]: Still up for something this weekend?
[Them - 2 days]: Not sure, might have plans
[You]: All good, maybe another time
[Them - 3 days]: Yeah"""

with st.expander("Load sample conversation to try it out"):
    if st.button("Load sample"):
        st.session_state["conversation_input"] = SAMPLE_CONVERSATION

conversation = st.text_area(
    "Paste your conversation here",
    value=st.session_state.get("conversation_input", ""),
    height=300,
    placeholder="[You]: Hey how are you?\n[Them - 2 min]: Good! You?\n[You]: Pretty good, want to hang out this weekend?\n[Them - 4 hours]: Maybe"
)

your_name = st.text_input(
    "What name do you use in this chat? (so the tool knows which side is you)",
    value="You",
    help="Type exactly how your name appears in the chat. If you copied from WhatsApp, it is usually your phone contact name."
)

st.write("Supported formats:")
st.code("[You]: message\n[Them - 20 min]: message\n[Them - 3 hours]: message\n[Them - 2 days]: message")
st.write("Or paste a WhatsApp export directly. The tool auto-detects the format.")

if st.button("Analyze conversation", type="primary"):
    if not conversation.strip():
        st.error("Paste a conversation first.")
    elif not os.environ.get("LLM_API_KEY"):
        st.error("LLM_API_KEY not set. Add it to your .env file.")
    else:
        with st.spinner("Analyzing signals..."):
            result = analyze_conversation(conversation, your_name)

        if "error" in result:
            st.error(result["error"])
        else:
            probability = result.get("ghosting_probability", 0)
            verdict = result.get("verdict", "Unknown")
            confidence = result.get("confidence", "low")

            if probability >= 75:
                color = "#c0392b"
                bar_color = "red"
            elif probability >= 50:
                color = "#e67e22"
                bar_color = "orange"
            elif probability >= 30:
                color = "#f39c12"
                bar_color = "yellow"
            else:
                color = "#27ae60"
                bar_color = "green"

            st.markdown("---")
            col1, col2 = st.columns([1, 2])

            with col1:
                st.markdown(f"<h1 style='color:{color}; font-size:64px; margin:0'>{probability}%</h1>", unsafe_allow_html=True)
                st.markdown(f"<p style='font-size:18px; font-weight:bold; color:{color}'>{verdict}</p>", unsafe_allow_html=True)
                st.write(f"Confidence: {confidence}")
                st.progress(probability / 100)

            with col2:
                st.write(f"Messages analyzed: {result.get('message_count', 0)}")
                st.write(f"Their messages: {result.get('their_count', 0)}")
                st.write(f"Your messages: {result.get('your_count', 0)}")

                tone_shift = result.get("tone_shift", "")
                if tone_shift:
                    st.write("Tone shift detected:")
                    st.info(tone_shift)

            st.markdown("---")

            what_changed = result.get("what_changed", "")
            if what_changed:
                st.subheader("What changed")
                st.write(what_changed)

            signals = result.get("signals_detected", [])
            if signals:
                st.subheader("Signals detected")
                for s in signals:
                    direction = s.get("direction", "neutral")
                    icon = "+" if direction == "positive" else "-" if direction == "negative" else "~"
                    weight = s.get("weight", "medium")
                    st.markdown(f"**[{icon}] {s.get('signal', '')}** ({weight} weight)")
                    st.write(s.get("explanation", ""))

            col_a, col_b = st.columns(2)
            with col_a:
                red_flags = result.get("red_flags", [])
                if red_flags:
                    st.subheader("Red flags")
                    for flag in red_flags:
                        st.write(f"- {flag}")

            with col_b:
                positives = result.get("positive_signs", [])
                if positives:
                    st.subheader("Positive signs")
                    for p in positives:
                        st.write(f"- {p}")

            st.markdown("---")
            recommendation = result.get("recommendation", "")
            if recommendation:
                st.subheader("Recommendation")
                st.write(recommendation)

            with st.expander("Raw signal data"):
                st.text(result.get("signals_summary", ""))
