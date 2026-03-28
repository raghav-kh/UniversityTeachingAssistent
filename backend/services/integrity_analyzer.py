import json
import logging
from typing import List, Dict, Any
from datetime import datetime, timezone

# Configure logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Risk thresholds
RISK_LOW = 0.4        # below this: clean, no action
RISK_MEDIUM = 0.7     # between low and this: flag for professor
RISK_HIGH = 0.85      # above this: trigger micro-viva

# Typing aliases
Event = Dict[str, Any]
Report = Dict[str, Any]


def analyze_session(events: List[Event], answer_text: str) -> Report:
    """
    Analyze a full editing session and return a risk report.

    Returns a dict with keys:
      - risk_score float 0.0-1.0
      - risk_level str low|medium|high
      - flags list of detected issues
      - viva_triggered bool
      - plus session stats from compute_session_stats
    """
    flags: List[Dict[str, Any]] = []
    risk_score = 0.0

    stats = compute_session_stats(events, answer_text)

    # CHECK A: Large paste relative to total answer length
    total_len = max(len(answer_text), 1)
    paste_ratio = stats["paste_char_total"] / total_len
    if paste_ratio > 0.6:
        risk_score += 0.35
        flags.append({
            "type": "large_paste",
            "detail": f"{paste_ratio:.0%} of answer was pasted in {stats['paste_count']} paste(s)",
            "severity": "high"
        })
    elif paste_ratio > 0.3:
        risk_score += 0.15
        flags.append({
            "type": "moderate_paste",
            "detail": f"{paste_ratio:.0%} of answer was pasted",
            "severity": "medium"
        })

    # CHECK B: Time on task vs answer length
    # realistic typing speed thresholds (chars/sec)
    total_time = max(stats["total_time_secs"], 1)
    chars_per_second = len(answer_text) / total_time
    # 10 chars/sec sustained is extremely unlikely; 5 chars/sec is still very fast
    if chars_per_second > 10 and len(answer_text) > 200:
        risk_score += 0.30
        flags.append({
            "type": "impossible_speed",
            "detail": f"Answer of {len(answer_text)} chars submitted in {stats['total_time_secs']}s ({chars_per_second:.1f} chars/sec)",
            "severity": "high"
        })
    elif chars_per_second > 5 and len(answer_text) > 200:
        risk_score += 0.15
        flags.append({
            "type": "fast_submission",
            "detail": f"Unusually fast typing cadence: {chars_per_second:.1f} chars/sec",
            "severity": "medium"
        })

    # CHECK C: No revisions for a long answer
    if len(answer_text) > 300 and stats["revision_count"] == 0:
        risk_score += 0.20
        flags.append({
            "type": "no_revisions",
            "detail": "Answer has 300+ characters with zero edits or deletions",
            "severity": "medium"
        })

    # CHECK D: Multiple focus losses (tab switching)
    if stats["focus_loss_count"] >= 5:
        risk_score += 0.15
        flags.append({
            "type": "frequent_tab_switch",
            "detail": f"Window lost focus {stats['focus_loss_count']} times during submission",
            "severity": "medium"
        })
    elif stats["focus_loss_count"] >= 3:
        risk_score += 0.05
        flags.append({
            "type": "tab_switch",
            "detail": f"Window lost focus {stats['focus_loss_count']} times",
            "severity": "low"
        })

    # CHECK E: Answer appeared all at once (no organic growth)
    if stats["paste_count"] >= 1 and stats["keystroke_count"] < 20:
        risk_score += 0.25
        flags.append({
            "type": "no_organic_growth",
            "detail": f"Only {stats['keystroke_count']} keystrokes recorded — answer likely pasted whole",
            "severity": "high"
        })

    # Finalize risk score
    risk_score = max(0.0, min(round(risk_score, 3), 1.0))

    if risk_score >= RISK_HIGH:
        risk_level = "high"
    elif risk_score >= RISK_LOW:
        risk_level = "medium"
    else:
        risk_level = "low"

    viva_triggered = risk_score >= RISK_HIGH

    report: Report = {
        "risk_score": risk_score,
        "risk_level": risk_level,
        "flags": flags,
        "viva_triggered": viva_triggered,
        **stats
    }
    logger.debug("Session analysis report: %s", report)
    return report


def compute_session_stats(events: List[Event], answer_text: str) -> Dict[str, Any]:
    """
    Compute session-level statistics from raw events.
    Returns a dict with:
      - total_time_secs int
      - paste_count int
      - paste_char_total int
      - keystroke_count int
      - focus_loss_count int
      - revision_count int
    """
    paste_count = 0
    paste_char_total = 0
    keystroke_count = 0
    focus_loss_count = 0
    revision_count = 0

    timestamps = []
    for e in events:
        ts_raw = e.get("timestamp")
        if not ts_raw:
            continue
        try:
            # Accept ISO format with or without Z
            if ts_raw.endswith("Z"):
                ts = datetime.fromisoformat(ts_raw.replace("Z", "+00:00"))
            else:
                ts = datetime.fromisoformat(ts_raw)
            timestamps.append(ts)
        except Exception as exc:
            logger.debug("Skipping malformed timestamp %s: %s", ts_raw, exc)
            continue

    if len(timestamps) >= 2:
        total_time_secs = int((max(timestamps) - min(timestamps)).total_seconds())
        # ensure non-negative
        total_time_secs = max(total_time_secs, 0)
    else:
        total_time_secs = 0

    for event in events:
        etype = (event.get("event_type") or "").lower()
        data = event.get("event_data") or {}

        if etype == "paste":
            paste_count += 1
            try:
                paste_char_total += int(data.get("char_count", 0))
            except Exception:
                # fallback: try to infer from pasted text if present
                pasted_text = data.get("text", "")
                paste_char_total += len(pasted_text or "")
        elif etype == "keystroke":
            keystroke_count += 1
        elif etype == "focus_loss":
            focus_loss_count += 1
        elif etype in ("delete", "backspace", "edit"):
            revision_count += 1

    return {
        "total_time_secs": total_time_secs,
        "paste_count": paste_count,
        "paste_char_total": paste_char_total,
        "keystroke_count": keystroke_count,
        "focus_loss_count": focus_loss_count,
        "revision_count": revision_count,
    }


# Quick self-test when run directly
if __name__ == "__main__":
    sample_events = [
        {"timestamp": "2026-03-09T23:50:00Z", "event_type": "keystroke", "event_data": {}},
        {"timestamp": "2026-03-09T23:51:00Z", "event_type": "paste", "event_data": {"char_count": 450}},
        {"timestamp": "2026-03-09T23:51:05Z", "event_type": "focus_loss", "event_data": {}},
    ]
    sample_answer = "x" * 500
    report = analyze_session(sample_events, sample_answer)
    print(json.dumps(report, indent=2))