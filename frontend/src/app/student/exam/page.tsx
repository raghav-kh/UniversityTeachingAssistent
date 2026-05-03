"use client";
import { useEffect, useRef, useState } from "react";
import { requireAuth } from "@/lib/auth";
import {
  getApiBaseURL,
  getAssignments,
  submitAnswer,
  analyzeIntegrity,
  logEvents,
  submitScan,
  submitVivaResponse,
} from "@/lib/api";
import { v4 as uuidv4 } from "uuid";
import { PageShell, PageHeader, SurfaceCard } from "@/components/ui/PagePrimitives";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

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
  flags: { type: string; detail: string; severity: string }[]; viva_id?: number | null;
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
            answer_text: answer,
          });
          setIntegrity(ir);
          if (ir.viva_triggered && ir.viva_id) {
            // Fetch viva questions
            const vivaData = await fetch(
              `${getApiBaseURL()}/integrity/viva/${ir.viva_id}`
            ).then((r) => r.json());
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
    const responseText = vivaInput.trim();
    const updatedResponses = [...vivaResponses, responseText];
    setVivaResponses(updatedResponses);
    setVivaInput("");
    try {
      await submitVivaResponse({
        viva_id: vivaId,
        question_index: vivaIdx,
        response: responseText,
        original_answer: answer,
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
    <PageShell className="max-w-3xl">
      <PageHeader title="Take Exam" subtitle="Submit typed or handwritten responses" badge="Student · Exam" />

      {/* Assignment picker */}
      {phase === "exam" && (
        <>
          <SurfaceCard className="space-y-3">
            <label className="text-sm text-muted-foreground">Select Assignment</label>
            <select
              value={selectedId ?? ""}
              onChange={(e) => setSelectedId(Number(e.target.value) || null)}
              className="h-10 w-full rounded-lg border border-input bg-background/70 px-3 text-sm text-foreground"
            >
              <option value="">Choose…</option>
              {assignments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title} ({a.type}, {a.max_marks} marks)
                </option>
              ))}
            </select>

            {selectedAssignment && (
              <div className="whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm text-foreground">
                {selectedAssignment.description}
              </div>
            )}
          </SurfaceCard>

          {selectedAssignment && (
            <>
              {/* Mode toggle */}
              <div className="flex gap-2">
                <button
                  onClick={() => setMode("text")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    mode === "text" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-accent"
                  }`}
                >
                  ✍️ Type Answer
                </button>
                <button
                  onClick={() => setMode("scan")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    mode === "scan" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-accent"
                  }`}
                >
                  📷 Upload Handwritten
                </button>
              </div>

              {mode === "text" ? (
                <Textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  rows={12}
                  placeholder="Write your answer here…"
                  className="resize-none rounded-xl px-4 py-3 text-sm"
                />
              ) : (
                <div className="space-y-3">
                  <label className="block text-sm text-muted-foreground">
                    Upload a photo or scan of your handwritten answer
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="block text-sm text-muted-foreground file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground"
                  />
                  {imagePreview && (
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="max-h-64 rounded-xl border border-border object-contain"
                    />
                  )}
                </div>
              )}

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <Button
                onClick={handleSubmit}
                disabled={
                  submitting ||
                  (mode === "text" && !answer.trim()) ||
                  (mode === "scan" && !imageFile)
                }
                className="h-11 w-full rounded-xl"
              >
                {submitting ? "Submitting…" : "Submit Answer"}
              </Button>
            </>
          )}
        </>
      )}

      {/* Grade result */}
      {(phase === "graded" || phase === "viva_active" || phase === "done") && grade && (
        <SurfaceCard className="space-y-3 p-6">
          <h2 className="text-lg font-semibold text-foreground">Grade Result</h2>
          <div className="flex items-center gap-4">
            <p className="text-3xl font-bold text-foreground">
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
          <p className="text-sm text-muted-foreground">{grade.feedback}</p>

          {ocrText && (
            <details className="mt-2 text-xs text-muted-foreground">
              <summary className="cursor-pointer text-muted-foreground">View OCR extracted text</summary>
              <pre className="mt-2 whitespace-pre-wrap rounded bg-muted p-3">{ocrText}</pre>
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
              <p className="text-sm font-semibold text-foreground">
                Integrity:{" "}
                <span className={riskColor[integrity.risk_level]}>
                  {integrity.risk_level}
                </span>{" "}
                (score: {integrity.risk_score.toFixed(2)})
              </p>
              {integrity.flags?.length > 0 && (
                <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
                  {integrity.flags.map((f, i) => <li key={i}>{f.type}: {f.detail}</li>)}
                </ul>
              )}
            </div>
          )}
        </SurfaceCard>
      )}

      {/* Inline Viva */}
      {phase === "viva_active" && vivaQuestions.length > 0 && (
        <SurfaceCard className="space-y-4 border-orange-500/40 p-6">
          <div className="flex items-center gap-2">
            <span className="text-orange-400 text-lg">🎤</span>
            <h2 className="text-lg font-semibold text-foreground">Oral Verification Required</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Your submission triggered an integrity check. Please answer the following
            questions to verify your understanding.
          </p>

          <div className="space-y-2">
            {/* Answered questions */}
            {vivaResponses.map((resp, i) => (
              <div key={i} className="space-y-1 rounded-lg bg-muted p-3">
                <p className="text-sm font-medium text-foreground">
                  Q{i + 1}: {vivaQuestions[i]?.question}
                </p>
                <p className="text-sm italic text-primary">"{resp}"</p>
              </div>
            ))}

            {/* Current question */}
            {vivaIdx < vivaQuestions.length && (
              <div className="space-y-3 rounded-lg border border-orange-500/40 bg-muted p-4">
                <p className="text-sm font-medium text-foreground">
                  Q{vivaIdx + 1} of {vivaQuestions.length}:{" "}
                  {vivaQuestions[vivaIdx].question}
                </p>
                <Textarea
                  value={vivaInput}
                  onChange={(e) => setVivaInput(e.target.value)}
                  rows={3}
                  placeholder="Your response…"
                  className="resize-none text-sm"
                />
                <Button
                  onClick={handleVivaSubmit}
                  disabled={vivaSubmitting || !vivaInput.trim()}
                  className="bg-orange-500 text-white hover:bg-orange-600"
                >
                  {vivaSubmitting ? "Submitting…" : vivaIdx + 1 < vivaQuestions.length ? "Next →" : "Finish Viva"}
                </Button>
              </div>
            )}
          </div>
        </SurfaceCard>
      )}

      {/* Done */}
      {phase === "done" && (
        <SurfaceCard className="space-y-3 border-green-500/40 bg-green-500/10 p-6 text-center">
          <p className="text-green-400 text-xl font-semibold">✓ All done!</p>
          <p className="text-sm text-muted-foreground">
            Your submission and viva responses have been recorded.
          </p>
          <Button
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
            className="mx-auto"
          >
            Take Another Exam
          </Button>
        </SurfaceCard>
      )}
    </PageShell>
  );
}