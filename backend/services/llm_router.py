import os
import re
import json
import requests
import logging
from dotenv import load_dotenv

load_dotenv()

# Config
OLLAMA_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:3b")
CONFIDENCE_THRESHOLD = float(os.getenv("CONFIDENCE_THRESHOLD", 0.85))

# Task tiers
TIER1_TASK_TYPES = {"mcq", "fill_blank", "true_false", "syntax_check"}
TIER2_TASK_TYPES = {"essay", "descriptive", "code_logic", "reasoning"}

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────
# MAIN ROUTER
# ──────────────────────────────────────────────────────────────────
def route_and_grade(task_type, question, student_answer, correct_answer, rubric, max_marks):
    tier = 1 if task_type in TIER1_TASK_TYPES else 2

    try:
        if tier == 1:
            result = grade_with_tier1(task_type, question, student_answer, correct_answer, rubric, max_marks)
        else:
            result = grade_with_tier2(task_type, question, student_answer, correct_answer, rubric, max_marks)

        # Escalate Tier-1 if confidence too low
        if tier == 1 and result["confidence"] < CONFIDENCE_THRESHOLD:
            logger.info("Escalating to Tier-2 due to low confidence")
            result = grade_with_tier2(task_type, question, student_answer, correct_answer, rubric, max_marks)
            result["escalated"] = True

    except Exception as e:
        logger.error(f"⚠ AI grading failed: {e}. Using keyword fallback.")
        result = keyword_fallback_grader(student_answer, correct_answer, max_marks)

    result["flagged"] = result["confidence"] < CONFIDENCE_THRESHOLD
    result["flag_reason"] = (
        f"Confidence {result['confidence']:.0%} below {int(CONFIDENCE_THRESHOLD*100)}% threshold"
        if result["flagged"] else None
    )
    result["tier"] = tier
    return result

# ──────────────────────────────────────────────────────────────────
# TIER 1 — objective questions
# ──────────────────────────────────────────────────────────────────
def grade_with_tier1(task_type, question, student_answer, correct_answer, rubric, max_marks) -> dict:
    prompt = build_grading_prompt(task_type, question, student_answer, correct_answer, rubric, max_marks, strict=True)
    raw = call_ollama(prompt, max_tokens=300)
    return parse_grading_response(raw, model_name=OLLAMA_MODEL, tier=1, max_marks=max_marks)

# ──────────────────────────────────────────────────────────────────
# TIER 2 — complex reasoning
# ──────────────────────────────────────────────────────────────────
def grade_with_tier2(task_type, question, student_answer, correct_answer, rubric, max_marks) -> dict:
    prompt = build_grading_prompt(task_type, question, student_answer, correct_answer, rubric, max_marks, strict=False)
    raw = call_ollama(prompt, max_tokens=500)
    return parse_grading_response(raw, model_name=f"{OLLAMA_MODEL}-tier2", tier=2, max_marks=max_marks)

# ──────────────────────────────────────────────────────────────────
# PROMPT BUILDER
# ──────────────────────────────────────────────────────────────────
def build_grading_prompt(task_type, question, student_answer, correct_answer, rubric, max_marks, strict: bool) -> str:
    if strict:
        return f"""Grade this answer. Respond ONLY with JSON.

Q: {question[:200]}
CORRECT: {correct_answer[:150]}
STUDENT: {student_answer[:200]}
MAX: {max_marks}

{{"score":<0-{max_marks}>,
"confidence":<0.0-1.0>,
"feedback":"<one sentence>",
"matched_concepts":[],
"missing_concepts":[]}}"""
    else:
        return f"""Grade this student answer. Respond ONLY with JSON.

QUESTION: {question[:200]}
KEY POINTS: {correct_answer[:200]}
STUDENT ANSWER: {student_answer[:300]}
MAX MARKS: {max_marks}

{{"score":<0-{max_marks}>,
"confidence":<0.0-1.0>,
"feedback":"<2 sentences>",
"matched_concepts":[],
"missing_concepts":[],
"rubric_breakdown":{{"accuracy":<0-40>,"depth":<0-30>,"clarity":<0-30>}}}}"""

# ──────────────────────────────────────────────────────────────────
# OLLAMA CALLER
# ──────────────────────────────────────────────────────────────────
def call_ollama(prompt: str, max_tokens: int = 300) -> str:
    try:
        response = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.1,
                    "num_predict": max_tokens,
                    "num_ctx": 1024,
                    "num_thread": 4,
                }
            },
            timeout=180
        )
        response.raise_for_status()
        return response.json().get("response", "")
    except requests.exceptions.Timeout:
        raise Exception("Ollama timed out during grading")
    except Exception as e:
        raise Exception(f"Ollama call failed: {str(e)}")

# ──────────────────────────────────────────────────────────────────
# RESPONSE PARSER
# ──────────────────────────────────────────────────────────────────
def parse_grading_response(raw: str, model_name: str, tier: int, max_marks: int) -> dict:
    cleaned = re.sub(r"```(?:json)?", "", raw).strip()
    json_match = re.search(r'\{.*\}', cleaned, re.DOTALL)

    if not json_match:
        logger.warning(f"⚠ Could not parse JSON from model response: {raw[:200]}")
        return {
            "score": 0,
            "confidence": 0.4,
            "feedback": "AI could not evaluate this answer. Professor review required.",
            "matched_concepts": [],
            "missing_concepts": [],
            "rubric_breakdown": {},
            "model_used": model_name,
            "raw_response": raw[:500]
        }

    try:
        data = json.loads(json_match.group())
        score = max(0, min(float(data.get("score", 0)), max_marks))
        confidence = max(0.0, min(float(data.get("confidence", 0.5)), 1.0))

        return {
            "score": score,
            "confidence": confidence,
            "feedback": data.get("feedback", "No feedback provided"),
            "matched_concepts": data.get("matched_concepts", []),
            "missing_concepts": data.get("missing_concepts", []),
            "rubric_breakdown": data.get("rubric_breakdown", {}),
            "model_used": model_name,
        }
    except (json.JSONDecodeError, ValueError) as e:
        logger.error(f"⚠ JSON parse error: {e} — raw: {raw[:200]}")
        return {
            "score": 0,
            "confidence": 0.3,
            "feedback": "Parsing error — needs professor review.",
            "matched_concepts": [],
            "missing_concepts": [],
            "rubric_breakdown": {},
            "model_used": model_name,
        }

# ──────────────────────────────────────────────────────────────────
# FALLBACK GRADER
# ──────────────────────────────────────────────────────────────────
def keyword_fallback_grader(student_answer: str, correct_answer: str, max_marks: int) -> dict:
    """
    Dead-simple keyword overlap grader.
    Used when Ollama is unavailable or times out.
    No AI needed — works instantly.
    """
    stop_words = {"the","a","an","is","are","was","were","it","in","on","at","to","of","and","or","for","with","this","that"}

    def keywords(text):
        words = re.findall(r'\b[a-z]{3,}\b', text.lower())
        return set(w for w in words if w not in stop_words)

    student_kw = keywords(student_answer)
    correct_kw = keywords(correct_answer)

    if not correct_kw:
        return {
            "score": max_marks * 0.5,
            "confidence": 0.4,
            "feedback": "Auto-graded (AI unavailable) — professor review recommended.",
            "matched_concepts": [],
            "missing_concepts": [],
            "model_used": "keyword_fallback",
        }

    # fraction of correct keywords present in student answer
    overlap = student_kw & correct_kw
    ratio = len(overlap) / len(correct_kw)
    score = round(ratio * max_marks, 1)

    return {
        "score": score,
        "confidence": 0.55,  # always below threshold → flagged
        "feedback": (
            f"Keyword-based grade (AI unavailable). "
            f"Matched {len(overlap)}/{len(correct_kw)} key concepts. "
            "Professor review required."
        ),
        "matched_concepts": list(overlap)[:5],
        "missing_concepts": list(correct_kw - student_kw)[:5],
        "model_used": "keyword_fallback",
    }
