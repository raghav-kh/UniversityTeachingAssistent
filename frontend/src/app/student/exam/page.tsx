"use client";
import { useEffect, useRef, useState } from "react";
import { requireAuth } from "@/lib/auth";
import {
  getAssignments,
  submitAnswer,
  analyzeIntegrity,
  logEvents,
  submitScan,
  submitVivaResponse,
} from "@/lib/api";
import { v4 as uuidv4 } from "uuid";

interface Assignment {
  id: number; title: string; description: string;
  type: string; max_marks: number;
}
interface GradeResult {
  submission_id: number; score: number; max_score: number;
  feedback: string; flagged: boolean; confidence: number;
}
interface IntegrityResult {
  risk_level: string; risk_score: number; viva_triggered: boolean;
  flags: string[]; viva_id?: number;
}
interface VivaQuestion { question: string; context?: string }

type Mode = "text" | "scan";
type Phase = "exam" | "graded" | "viva_active" | "done";

export default function StudentExamPage() {
  const user = requireAuth(["student"]);

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>("text");
  const [answer, setAnswer] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("exam");
  const [grade, setGrade] = useState<GradeResult | null>(null);
  const [integrity, setIntegrity] = useState<IntegrityResult | null>(null);
  const [ocrText, setOcrText] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Viva state
  const [vivaId, setVivaId] = useState<number | null>(null);
  const [vivaQuestions, setVivaQuestions] = useState<VivaQuestion[]>([]);
  const [vivaResponses, setVivaResponses] = useState<string[]>([]);
  const [vivaIdx, setVivaIdx] = useState(0);
  const [vivaInput, setVivaInput] = useState("");
  const [vivaSubmitting, setVivaSubmitting] = useState(false);

  // Integrity tracker
  const sessionId = useRef(uuidv4());
  const eventBuffer = useRef<any[]>([]);
  const flushTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const selectedAssignment = assignments.find((a) => a.id === selectedId) ?? null;

  useEffect(() => {
    getAssignments().then(setAssignments).catch(console.error);
  }, []);

  // Keystroke tracking
  useEffect(() => {
    if (mode !== "text" || phase !== "exam") return;
    const push = (type: string, data = {}) => {
      eventBuffer.current.push({ type, timestamp: Date.now(), ...data });
    };
    const onKey = () => push("keystroke");
    const onPaste = () => push("paste");
    const onBlur = () => push("focus_loss");
    window.addEventListener("keydown", onKey);
    window.addEventListener("paste", onPaste);
    window.addEventListener("blur", onBlur);
    flushTimer.current = setInterval(flushEvents, 5000);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("paste", onPaste);
      window.removeEventListener("blur", onBlur);
      if (flushTimer.current) clearInterval(flushTimer.current);
    };
  }, [mode, phase]);

  async function flushEvents() {
    if (!selectedId || eventBuffer.current.length === 0) return;
    const toSend = [...eventBuffer.current];
    eventBuffer.current = [];
    try {
      await logEvents({
        student_id: user.username,
        assignment_id: selectedId,
        session_id: sessionId.current,
        events: toSend,
      });
    } catch { /* non-fatal */ }
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setImageFile(f);
    if (f) setImagePreview(URL.createObjectURL(f));
    else setImagePreview(null);
  }

  async function handleSubmit() {
    if (!selectedAssignment) return;
    setSubmitting(true);
    setError("");
    try {
      let gradeResult: GradeResult;
      let submissionId: number;
      let extractedText: string | null = null;

      if (mode === "scan" && imageFile) {
        // OCR path
        const fd = new FormData();
        fd.append("assignment_id", String(selectedAssignment.id));
        fd.append("student_name", user.name);
        fd.append("student_id", user.username);
        fd.append("image", imageFile);
        const scanResult = await submitScan(fd);
        gradeResult = scanResult.grade;
        submissionId = scanResult.submission_id;
        extractedText = scanResult.ocr_text;
        setOcrText(extractedText);
      } else {
        // Text path — flush remaining events first
        await flushEvents();
        const result = await submitAnswer({
          assignment_id: selectedAssignment.id,
          student_name: user.name,
          student_id: user.username,
          answer_text: answer,
        });
        gradeResult = result;
        submissionId = result.submission_id;
      }

      setGrade(gradeResult);
      setPhase("graded");

      // Integrity analysis (text mode only — scan doesn't have keystroke data)
      if (mode === "text") {
        try {
          const ir = await analyzeIntegrity({
            submission_id: submissionId,
            student_id: user.username,
            assignment_id: selectedAssignment.id,
            session_id: sessionId.current,
          });
          setIntegrity(ir);
          if (ir.viva_triggered && ir.viva_id) {
            // Fetch viva questions
            const vivaData = await fetch(`/integrity/viva/${ir.viva_id}`).then((r) => r.json());
            setVivaQuestions(vivaData.questions ?? []);
            setVivaId(ir.viva_id);
            setPhase("viva_active");
          }
        } catch { /* integrity non-fatal */ }
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVivaSubmit() {
    if (!vivaId || !vivaInput.trim()) return;
    setVivaSubmitting(true);
    const updatedResponses = [...vivaResponses, vivaInput.trim()];
    setVivaResponses(updatedResponses);
    setVivaInput("");
    try {
      await submitVivaResponse({
        viva_id: vivaId,
        question_index: vivaIdx,
        response: vivaInput.trim(),
      });
    } catch { /* non-fatal */ }
    if (vivaIdx + 1 >= vivaQuestions.length) {
      setPhase("done");
    } else {
      setVivaIdx((i) => i + 1);
    }
    setVivaSubmitting(false);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const riskColor: Record<string, string> = {
    LOW: "text-green-400", MEDIUM: "text-yellow-400", HIGH: "text-red-400",
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white">Take Exam</h1>

      {/* Assignment picker */}
      {phase === "exam" && (
        <>
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 space-y-3">
            <label className="text-sm text-gray-400">Select Assignment</label>
            <select
              value={selectedId ?? ""}
              onChange={(e) => setSelectedId(Number(e.target.value) || null)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
            >
              <option value="">Choose…</option>
              {assignments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title} ({a.type}, {a.max_marks} marks)
                </option>
              ))}
            </select>

            {selectedAssignment && (
              <div className="bg-gray-700 rounded-lg p-3 text-sm text-gray-200 whitespace-pre-wrap">
                {selectedAssignment.description}
              </div>
            )}
          </div>

          {selectedAssignment && (
            <>
              {/* Mode toggle */}
              <div className="flex gap-2">
                <button
                  onClick={() => setMode("text")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    mode === "text" ? "bg-indigo-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
                >
                  ✍️ Type Answer
                </button>
                <button
                  onClick={() => setMode("scan")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    mode === "scan" ? "bg-indigo-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
                >
                  📷 Upload Handwritten
                </button>
              </div>

              {mode === "text" ? (
                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  rows={12}
                  placeholder="Write your answer here…"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 resize-none"
                />
              ) : (
                <div className="space-y-3">
                  <label className="block text-sm text-gray-400">
                    Upload a photo or scan of your handwritten answer
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="block text-sm text-gray-300 file:bg-indigo-600 file:text-white file:border-0 file:rounded-lg file:px-3 file:py-1.5 file:mr-3 file:cursor-pointer"
                  />
                  {imagePreview && (
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="max-h-64 rounded-xl border border-gray-600 object-contain"
                    />
                  )}
                </div>
              )}

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <button
                onClick={handleSubmit}
                disabled={
                  submitting ||
                  (mode === "text" && !answer.trim()) ||
                  (mode === "scan" && !imageFile)
                }
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-medium text-sm disabled:opacity-50 transition-colors"
              >
                {submitting ? "Submitting…" : "Submit Answer"}
              </button>
            </>
          )}
        </>
      )}

      {/* Grade result */}
      {(phase === "graded" || phase === "viva_active" || phase === "done") && grade && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 space-y-3">
          <h2 className="text-lg font-semibold text-white">Grade Result</h2>
          <div className="flex items-center gap-4">
            <p className="text-3xl font-bold text-white">
              {grade.score}/{grade.max_score}
            </p>
            <p
              className={`text-sm font-semibold ${
                grade.score / grade.max_score >= 0.5 ? "text-green-400" : "text-red-400"
              }`}
            >
              {((grade.score / grade.max_score) * 100).toFixed(1)}%
            </p>
            {grade.flagged && (
              <span className="text-xs bg-yellow-900 text-yellow-300 px-2 py-0.5 rounded">
                ⚠ Flagged for review
              </span>
            )}
          </div>
          <p className="text-gray-300 text-sm">{grade.feedback}</p>

          {ocrText && (
            <details className="text-xs text-gray-500 mt-2">
              <summary className="cursor-pointer text-gray-400">View OCR extracted text</summary>
              <pre className="mt-2 bg-gray-900 rounded p-3 whitespace-pre-wrap">{ocrText}</pre>
            </details>
          )}

          {integrity && (
            <div className={`mt-3 p-3 rounded-lg border ${
              integrity.risk_level === "HIGH"
                ? "bg-red-900/20 border-red-700"
                : integrity.risk_level === "MEDIUM"
                ? "bg-yellow-900/20 border-yellow-700"
                : "bg-green-900/20 border-green-700"
            }`}>
              <p className="text-sm font-semibold text-gray-200">
                Integrity:{" "}
                <span className={riskColor[integrity.risk_level]}>
                  {integrity.risk_level}
                </span>{" "}
                (score: {integrity.risk_score.toFixed(2)})
              </p>
              {integrity.flags?.length > 0 && (
                <ul className="mt-1 text-xs text-gray-400 list-disc list-inside">
                  {integrity.flags.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* Inline Viva */}
      {phase === "viva_active" && vivaQuestions.length > 0 && (
        <div className="bg-gray-800 border border-orange-700 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-orange-400 text-lg">🎤</span>
            <h2 className="text-lg font-semibold text-white">Oral Verification Required</h2>
          </div>
          <p className="text-sm text-gray-400">
            Your submission triggered an integrity check. Please answer the following
            questions to verify your understanding.
          </p>

          <div className="space-y-2">
            {/* Answered questions */}
            {vivaResponses.map((resp, i) => (
              <div key={i} className="bg-gray-700 rounded-lg p-3 space-y-1">
                <p className="text-sm text-gray-300 font-medium">
                  Q{i + 1}: {vivaQuestions[i]?.question}
                </p>
                <p className="text-sm text-indigo-300 italic">"{resp}"</p>
              </div>
            ))}

            {/* Current question */}
            {vivaIdx < vivaQuestions.length && (
              <div className="bg-gray-700 border border-orange-600 rounded-lg p-4 space-y-3">
                <p className="text-sm text-white font-medium">
                  Q{vivaIdx + 1} of {vivaQuestions.length}:{" "}
                  {vivaQuestions[vivaIdx].question}
                </p>
                <textarea
                  value={vivaInput}
                  onChange={(e) => setVivaInput(e.target.value)}
                  rows={3}
                  placeholder="Your response…"
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500 resize-none"
                />
                <button
                  onClick={handleVivaSubmit}
                  disabled={vivaSubmitting || !vivaInput.trim()}
                  className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50"
                >
                  {vivaSubmitting ? "Submitting…" : vivaIdx + 1 < vivaQuestions.length ? "Next →" : "Finish Viva"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Done */}
      {phase === "done" && (
        <div className="bg-green-900/20 border border-green-700 rounded-xl p-6 text-center space-y-3">
          <p className="text-green-400 text-xl font-semibold">✓ All done!</p>
          <p className="text-gray-400 text-sm">
            Your submission and viva responses have been recorded.
          </p>
          <button
            onClick={() => {
              setPhase("exam");
              setGrade(null);
              setIntegrity(null);
              setAnswer("");
              setImageFile(null);
              setImagePreview(null);
              setOcrText(null);
              setVivaId(null);
              setVivaQuestions([]);
              setVivaResponses([]);
              setVivaIdx(0);
              sessionId.current = uuidv4();
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg text-sm"
          >
            Take Another Exam
          </button>
        </div>
      )}
    </div>
  );
}