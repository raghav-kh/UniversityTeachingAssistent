"""
Unified text completion for serverless: prefer OpenAI when configured or on Vercel,
otherwise Ollama. Keeps cold paths lazy-imported where possible.
"""
import os
import logging
import requests

logger = logging.getLogger(__name__)


def _backend() -> str:
    explicit = os.getenv("LLM_BACKEND", os.getenv("GRADING_LLM", "")).strip().lower()
    if explicit in ("openai", "ollama"):
        return explicit
    if os.getenv("VERCEL") == "1" and os.getenv("OPENAI_API_KEY"):
        return "openai"
    return "ollama"


def active_provider() -> str:
    """openai | ollama — used for metrics / model_used labels."""
    return _backend()


def complete_text(prompt: str, max_tokens: int = 300, temperature: float = 0.1) -> str:
    if _backend() == "openai":
        return _openai_complete(prompt, max_tokens=max_tokens, temperature=temperature)
    return _ollama_complete(prompt, max_tokens=max_tokens, temperature=temperature)


def _openai_complete(prompt: str, max_tokens: int, temperature: float) -> str:
    from openai import OpenAI

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set (required for OpenAI / Vercel grading path)")

    model = os.getenv("OPENAI_GRADING_MODEL", os.getenv("OPENAI_CHAT_MODEL", "gpt-4o-mini"))
    client = OpenAI(api_key=api_key)
    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        temperature=temperature,
        max_tokens=max_tokens,
    )
    if not response.choices:
        return ""
    return (response.choices[0].message.content or "").strip()


def _ollama_complete(prompt: str, max_tokens: int, temperature: float) -> str:
    base = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
    model = os.getenv("OLLAMA_MODEL", "llama3.2:3b")
    timeout = int(os.getenv("OLLAMA_TIMEOUT_SECONDS", "120"))
    response = requests.post(
        f"{base}/api/generate",
        json={
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
                "num_ctx": 1024,
            },
        },
        timeout=timeout,
    )
    response.raise_for_status()
    data = response.json()
    return (data.get("response") or "").strip() if isinstance(data, dict) else ""
