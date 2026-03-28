import requests

print("Testing Ollama connection...")

# Test 1: is Ollama reachable?
try:
    r = requests.get("http://localhost:11434/api/tags", timeout=5)
    models = [m["name"] for m in r.json().get("models", [])]
    print(f"✅ Ollama reachable. Models available: {models}")
except Exception as e:
    print(f"❌ Ollama unreachable: {e}")
    print("   Fix: run 'ollama serve' in a separate terminal")
    exit()

# Test 2: can it generate?
print("\nTesting generation (this may take 30s on first run)...")
try:
    r = requests.post(
        "http://localhost:11434/api/generate",
        json={
            "model": "llama3.2:3b",
            "prompt": "Reply with exactly: WORKING",
            "stream": False,
            "options": {"num_predict": 10}
        },
        timeout=120
    )
    result = r.json()
    print(f"✅ Generation works. Response: {result.get('response', 'NO RESPONSE KEY')}")
except requests.exceptions.Timeout:
    print("❌ Timed out — model is loading. Wait 60s and retry.")
except Exception as e:
    print(f"❌ Generation failed: {e}")