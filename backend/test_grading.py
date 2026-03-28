import requests

BASE = "http://127.0.0.1:8000"

# Step 1: submit and grade
print("Testing grading submission...")
r = requests.post(f"{BASE}/grading/submit", json={
    "assignment_id": 1,
    "student_name": "Priya Patel",
    "student_id": "CS002",
    "answer_text": "A stack is a linear data structure that follows LIFO. The last element inserted is the first one removed. Push adds to top in O(1), pop removes from top in O(1). Stacks are used in recursion, expression parsing, and browser history."
})
print(f"Status: {r.status_code}")
result = r.json()
print(f"Result: {result}")

submission_id = result.get("submission_id")
print(f"\n✅ submission_id to use in integrity/analyze: {submission_id}")

# Step 2: log some fake events
print("\nLogging integrity events...")
r2 = requests.post(f"{BASE}/integrity/events", json={
    "events": [
        {
            "student_id": "CS002",
            "assignment_id": 1,
            "session_id": "sess_test001",
            "event_type": "paste",
            "event_data": {"char_count": 850},
            "timestamp": "2024-01-15T10:00:05Z"
        },
        {
            "student_id": "CS002",
            "assignment_id": 1,
            "session_id": "sess_test001",
            "event_type": "keystroke",
            "event_data": {"key": "Enter"},
            "timestamp": "2024-01-15T10:00:28Z"
        }
    ]
})
print(f"Events logged: {r2.json()}")

# Step 3: analyze with real submission_id
if not submission_id:
    print("❌ Grading failed — cannot test integrity without submission_id")
    print("Check Ollama is running and try again")
else:
    # Step 3: analyze with real submission_id
    print("\nAnalyzing integrity...")
    r3 = requests.post(f"{BASE}/integrity/analyze", json={
        "student_id": "CS002",
        "assignment_id": 1,
        "submission_id": submission_id,
        "session_id": "sess_test001",
        "answer_text": "A stack is a linear data structure that follows LIFO. Push adds to top in O(1), pop removes from top in O(1). Used in recursion and browser history."
    })
    print(f"Risk report: {r3.json()}")