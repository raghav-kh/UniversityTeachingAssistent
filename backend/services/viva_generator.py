import os
import re
import json
import logging
from typing import List, Dict, Any, Optional

import requests
from dotenv import load_dotenv

load_dotenv()

OLLAMA_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:3b")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Validate minimal config
if not OLLAMA_URL:
    logger.warning("OLLAMA_BASE_URL not set; using default localhost URL.")
if not OLLAMA_MODEL:
    logger.warning("OLLAMA_MODEL not set; using default model.")


def _safe_json_extract(raw: str) -> Optional[Any]:
    """
    Try to extract a JSON object or array from raw text.
    Returns parsed JSON or None.
    """
    raw = raw.strip()
    # Try direct load first
    try:
        return json.loads(raw)
    except Exception:
        pass

    # Try to find a JSON object or array inside the text
    patterns = [r'(\[.*\])', r'(\{.*\})']
    for p in patterns:
        match = re.search(p, raw, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1))
            except Exception:
                continue
    return None


def _post_to_ollama(prompt: str, num_predict: int = 200, timeout: int = 120) -> str:
    """
    Post a prompt to Ollama and return the raw response string.
    Raises Exception on failure.
    """
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.3,
            "num_predict": num_predict,
            "num_ctx": 1024,
        },
    }
    try:
        resp = requests.post(f"{OLLAMA_URL}/api/generate", json=payload, timeout=timeout)
        resp.raise_for_status()
        data = resp.json()
        # Ollama responses often include a "response" field
        return data.get("response", "") if isinstance(data, dict) else ""
    except requests.exceptions.Timeout:
        raise Exception("Ollama request timed out")
    except requests.exceptions.RequestException as e:
        raise Exception(f"Ollama request failed: {e}")
    except ValueError:
        # JSON decode error
        raise Exception("Invalid JSON response from Ollama")


def generate_viva_questions(
    assignment_title: str,
    student_answer: str,
    flags: List[Dict[str, Any]],
    num_questions: int = 3
) -> List[Dict[str, str]]:
    """
    Generate targeted viva questions based on the student's submission and integrity flags.
    Returns a list of question dicts:
      {"question": str, "difficulty": "easy|medium|hard", "targets": str}
    """
    # Build a concise flag summary
    flag_types = [f.get("type", "unknown") for f in flags] if flags else []
    flag_summary = ", ".join(flag_types) if flag_types else "none"

    # Truncate student answer to avoid huge prompts
    student_excerpt = student_answer.strip()[:800]

    prompt = (
        f"A student submitted an answer that triggered academic integrity flags: {flag_summary}.\n"
        f"You must generate {num_questions} short viva questions to verify they understand their own submission.\n\n"
        f"ASSIGNMENT: {assignment_title}\n\n"
        f"STUDENT'S ANSWER:\n{student_excerpt}\n\n"
        "Rules for questions:\n"
        "- Ask about SPECIFIC parts of their answer (quote their own words back)\n"
        "- Questions should be answerable in 2-3 sentences if they wrote it themselves\n"
        "- Do NOT ask yes/no questions\n"
        "- Vary difficulty: 1 easy, 1 medium, 1 hard\n\n"
        "Respond ONLY with a valid JSON array of objects like:\n"
        '[{"question":"...","difficulty":"easy|medium|hard","targets":"..."}]\n'
    )

    try:
        raw = _post_to_ollama(prompt, num_predict=400, timeout=120)
        parsed = _safe_json_extract(raw)
        if isinstance(parsed, list):
            # Normalize and limit number of questions
            questions: List[Dict[str, str]] = []
            for item in parsed[:num_questions]:
                if not isinstance(item, dict):
                    continue
                q = {
                    "question": str(item.get("question", "")).strip(),
                    "difficulty": str(item.get("difficulty", "medium")).strip(),
                    "targets": str(item.get("targets", "")).strip(),
                }
                if q["question"]:
                    questions.append(q)
            if questions:
                return questions
        logger.warning("Viva generation returned unexpected format; falling back to defaults.")
    except Exception as e:
        logger.error(f"Viva generation failed: {e}")

    # Fallback questions
    return [
        {
            "question": f"Explain the main concept in your answer to: {assignment_title}",
            "difficulty": "easy",
            "targets": "basic understanding"
        },
        {
            "question": "Walk me through how you arrived at your answer step by step.",
            "difficulty": "medium",
            "targets": "reasoning process"
        },
        {
            "question": "What would change in your answer if the question asked about a different scenario?",
            "difficulty": "hard",
            "targets": "depth of understanding"
        }
    ][:num_questions]


def evaluate_viva_response(
    question: str,
    student_response: str,
    original_answer: str
) -> Dict[str, Any]:
    """
    Evaluate a single viva response. Returns a dict:
      {"score": float (0-10), "understands": bool|None, "feedback": str}
    """
    q = question.strip()[:400]
    resp_excerpt = student_response.strip()[:800]
    original_excerpt = original_answer.strip()[:400]

    prompt = (
        "Evaluate if this student understands their own submission.\n\n"
        f"ORIGINAL SUBMISSION EXCERPT: {original_excerpt}\n"
        f"VIVA QUESTION: {q}\n"
        f"STUDENT'S VIVA RESPONSE: {resp_excerpt}\n\n"
        "Does the response show genuine understanding of the submitted work?\n"
        "Respond ONLY with JSON:\n"
        '{ "score": <0 to 10>, "understands": <true or false or null>, "feedback": "<one sentence assessment>" }'
    )

    try:
        raw = _post_to_ollama(prompt, num_predict=150, timeout=90)
        parsed = _safe_json_extract(raw)
        if isinstance(parsed, dict):
            # Normalize values
            score = parsed.get("score")
            try:
                score = float(score)
            except Exception:
                score = None
            if score is None:
                score = 5.0
            score = max(0.0, min(10.0, score))

            understands = parsed.get("understands")
            if isinstance(understands, str):
                understands_lower = understands.lower()
                if understands_lower in {"true", "yes"}:
                    understands = True
                elif understands_lower in {"false", "no"}:
                    understands = False
                else:
                    understands = None
            elif isinstance(understands, bool):
                pass
            else:
                understands = None

            feedback = str(parsed.get("feedback", "")).strip() or "No feedback provided."

            return {"score": score, "understands": understands, "feedback": feedback}

    except Exception as e:
        logger.error(f"Viva evaluation failed: {e}")

    # Fallback evaluation
    return {"score": 5.0, "understands": None, "feedback": "Could not evaluate response automatically."}


# Example quick test when run directly
if __name__ == "__main__":
    sample_submission = "I implemented quicksort by choosing the first element as pivot and partitioning..."
    flags_example = [{"type": "paste"}, {"type": "idle"}]
    qs = generate_viva_questions("Sorting Algorithms", sample_submission, flags_example, num_questions=3)
    print("Generated questions:", qs)

    eval_result = evaluate_viva_response(qs[0]["question"], "I partitioned the array around the pivot...", sample_submission)
    print("Evaluation:", eval_result)
