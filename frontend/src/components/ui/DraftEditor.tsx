"use client";

import { useEffect, useRef, useState } from "react";
import { useIntegrityTracker } from "@/hooks/useIntegrityTracker";
import { submitAnswer, analyzeIntegrity, GradingResult, IntegrityReport } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Send, Shield, AlertTriangle, CheckCircle,
  Clock, Clipboard, Keyboard, Eye
} from "lucide-react";

interface DraftEditorProps {
  assignmentId: number;
  assignmentTitle: string;
  assignmentType: string;
  maxMarks: number;
  studentId: string;
  studentName: string;
}

type SubmitState = "idle" | "grading" | "analyzing" | "done" | "error";

export default function DraftEditor({
  assignmentId, assignmentTitle,
  assignmentType, maxMarks,
  studentId, studentName,
}: DraftEditorProps) {

  const [answer, setAnswer]           = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [grade, setGrade]             = useState<GradingResult | null>(null);
  const [integrity, setIntegrity]     = useState<IntegrityReport | null>(null);
  const [error, setError]             = useState("");

  // live session stats shown in the status bar
  const [liveStats, setLiveStats] = useState({
    keystrokes: 0, pastes: 0, edits: 0, focusLoss: 0
  });

  // timestamps for time-on-task display
  const startTime = useRef<number>(Date.now());
  const [elapsed, setElapsed] = useState(0);

  const tracker = useIntegrityTracker(studentId, assignmentId);

  // ── start tracking on mount ──────────────────────────────────
  useEffect(() => {
    tracker.startTracking();

    // tick elapsed time every second
    const tick = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.current) / 1000));
    }, 1000);

    return () => {
      tracker.stopTracking();
      clearInterval(tick);
    };
  }, []);

  // ── wrap handlers to also update live stats display ───────────
  const wrappedHandlers = {
    onKeyDown: (e: React.KeyboardEvent) => {
      tracker.handlers.onKeyDown(e);
      if (e.key === "Backspace" || e.key === "Delete") {
        setLiveStats(s => ({ ...s, edits: s.edits + 1 }));
      } else if (e.key.length === 1) {
        setLiveStats(s => ({ ...s, keystrokes: s.keystrokes + 1 }));
      }
    },
    onPaste: (e: React.ClipboardEvent) => {
      tracker.handlers.onPaste(e);
      setLiveStats(s => ({ ...s, pastes: s.pastes + 1 }));
    },
    onFocus: (e: React.FocusEvent) => {
      tracker.handlers.onFocus();
      setLiveStats(s => ({ ...s, focusLoss: s.focusLoss + 1 }));
    },
    onBlur: tracker.handlers.onBlur,
  };

  // ── format elapsed time as mm:ss ──────────────────────────────
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // ── submit handler ─────────────────────────────────────────────
  async function handleSubmit() {
    if (!answer.trim()) return;
    setError("");

    try {
      // step 1: flush remaining events before submitting
      setSubmitState("grading");
      await tracker.flush();

      // step 2: grade the answer
      const gradeResult = await submitAnswer({
        assignment_id: assignmentId,
        student_name: studentName,
        student_id: studentId,
        answer_text: answer,
      });
      setGrade(gradeResult);

      // step 3: analyze integrity using the real submission_id
      setSubmitState("analyzing");
      const integrityResult = await analyzeIntegrity({
        student_id: studentId,
        assignment_id: assignmentId,
        submission_id: gradeResult.submission_id,  // real ID from grading
        session_id: tracker.sessionId,
        answer_text: answer,
      });
      setIntegrity(integrityResult);
      setSubmitState("done");

    } catch (e: any) {
      setError(e?.response?.data?.detail || "Submission failed");
      setSubmitState("error");
    }
  }

  const riskColor = (level?: string) => ({
    high:   "text-red-400 border-red-400/30 bg-red-400/10",
    medium: "text-amber-400 border-amber-400/30 bg-amber-400/10",
    low:    "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
  }[level ?? "low"] ?? "text-zinc-400");

  const isSubmitting = submitState === "grading" || submitState === "analyzing";

  // ── RESULT VIEW ───────────────────────────────────────────────
  if (submitState === "done" && grade && integrity) {
    return (
      <div className="space-y-4">
        {/* Grade result */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">Grading Result</h3>
            <Badge className={grade.flagged
              ? "bg-amber-400/10 text-amber-400 border-amber-400/30"
              : "bg-emerald-400/10 text-emerald-400 border-emerald-400/30"
            }>
              {grade.flagged ? "⚠ Flagged" : "✓ Auto-approved"}
            </Badge>
          </div>

          <div className="flex items-end gap-4 mb-4">
            <div className="text-5xl font-bold text-white">{grade.score}</div>
            <div className="text-zinc-500 text-xl mb-1">/ {grade.max_score}</div>
            <div className="ml-auto text-right">
              <div className="text-3xl font-bold text-emerald-400">{grade.percentage}%</div>
              <div className="text-xs text-zinc-500">Tier-{grade.tier_used} · {grade.confidence ? Math.round(grade.confidence * 100) : "?"}% confidence</div>
            </div>
          </div>

          <p className="text-sm text-zinc-300 leading-relaxed bg-zinc-800/50 p-3 rounded-lg border border-zinc-700/30">
            {grade.feedback}
          </p>

          {/* Concepts */}
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <div className="text-xs text-emerald-400 mb-2 flex items-center gap-1">
                <CheckCircle size={10} /> Matched concepts
              </div>
              <div className="flex flex-wrap gap-1">
                {grade.matched_concepts.length > 0
                  ? grade.matched_concepts.map(c => (
                      <Badge key={c} className="text-[10px] bg-emerald-400/10 text-emerald-400 border-emerald-400/20">{c}</Badge>
                    ))
                  : <span className="text-xs text-zinc-600">None</span>
                }
              </div>
            </div>
            <div>
              <div className="text-xs text-red-400 mb-2 flex items-center gap-1">
                <AlertTriangle size={10} /> Missing concepts
              </div>
              <div className="flex flex-wrap gap-1">
                {grade.missing_concepts.length > 0
                  ? grade.missing_concepts.map(c => (
                      <Badge key={c} className="text-[10px] bg-red-400/10 text-red-400 border-red-400/20">{c}</Badge>
                    ))
                  : <span className="text-xs text-zinc-600">None</span>
                }
              </div>
            </div>
          </div>
        </div>

        {/* Integrity result */}
        <div className={`border rounded-xl p-6 ${riskColor(integrity.risk_level)}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Shield size={16} />
              <h3 className="font-semibold">Integrity Report</h3>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">
                {Math.round(integrity.risk_score * 100)}
              </div>
              <div className="text-xs opacity-70">risk score</div>
            </div>
          </div>

          {/* Session stats */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            {[
              { icon: Clock,     label: "Time",       val: `${integrity.session_stats.total_time_secs}s` },
              { icon: Clipboard, label: "Pastes",     val: integrity.session_stats.paste_count },
              { icon: Keyboard,  label: "Keystrokes", val: integrity.session_stats.keystroke_count },
              { icon: Eye,       label: "Tab switches", val: integrity.session_stats.focus_loss_count },
            ].map(s => (
              <div key={s.label} className="bg-black/20 rounded-lg p-3 text-center">
                <s.icon size={14} className="mx-auto mb-1 opacity-70" />
                <div className="text-lg font-bold">{s.val}</div>
                <div className="text-[10px] opacity-60">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Flags */}
          {integrity.flags.length > 0 && (
            <div className="space-y-2 mb-4">
              {integrity.flags.map((f, i) => (
                <div key={i} className="flex items-start gap-2 bg-black/20 rounded-lg p-2.5">
                  <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-xs font-medium">{f.type.replace(/_/g, " ")}</div>
                    <div className="text-[11px] opacity-70">{f.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Viva triggered */}
          {integrity.viva_triggered && (
            <div className="bg-black/30 rounded-lg p-4 border border-current/30">
              <div className="flex items-center gap-2 font-semibold mb-2">
                🎤 Micro-Viva Triggered
              </div>
              <p className="text-xs opacity-80 mb-3">
                Based on behavioral patterns, a 3-minute viva has been scheduled.
                Viva ID: <strong>{integrity.viva_id}</strong>
              </p>
              <div className="space-y-2">
                {integrity.viva_questions.map((q, i) => (
                  <div key={i} className="bg-black/20 rounded p-2.5 text-xs">
                    <span className="opacity-60">Q{i + 1} ({q.difficulty}): </span>
                    {q.question}
                  </div>
                ))}
              </div>
            </div>
          )}

          {integrity.risk_level === "low" && (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle size={14} />
              No integrity concerns detected. Clean submission.
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── EDITOR VIEW ───────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {/* Assignment info */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
          {assignmentType} · {maxMarks} marks
        </div>
        <h3 className="font-semibold text-white">{assignmentTitle}</h3>
      </div>

      {/* Live tracking status bar */}
      <div className="flex items-center gap-4 px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl">
        <div className="flex items-center gap-1.5 text-xs text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Tracking active
        </div>
        <div className="flex gap-4 ml-auto text-xs text-zinc-500">
          <span className="flex items-center gap-1">
            <Clock size={10} /> {formatTime(elapsed)}
          </span>
          <span className="flex items-center gap-1">
            <Keyboard size={10} /> {liveStats.keystrokes} keys
          </span>
          <span className="flex items-center gap-1">
            <Clipboard size={10} /> {liveStats.pastes} pastes
          </span>
          <span className="flex items-center gap-1">
            ✏ {liveStats.edits} edits
          </span>
          <span className="flex items-center gap-1">
            <Eye size={10} /> {liveStats.focusLoss} switches
          </span>
        </div>
      </div>

      {/* The editor itself */}
      <div className="relative">
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={wrappedHandlers.onKeyDown}
          onPaste={wrappedHandlers.onPaste}
          onFocus={wrappedHandlers.onFocus}
          onBlur={wrappedHandlers.onBlur}
          placeholder="Write your answer here. Every keystroke, paste, and edit is tracked to verify authentic work..."
          className="w-full min-h-[280px] bg-zinc-900 border border-zinc-700 rounded-xl p-4 text-sm text-zinc-100 placeholder-zinc-600 resize-none focus:outline-none focus:border-emerald-500/50 transition-colors leading-relaxed"
          disabled={isSubmitting}
        />
        {/* word count */}
        <div className="absolute bottom-3 right-3 text-xs text-zinc-600">
          {answer.trim() ? answer.trim().split(/\s+/).length : 0} words
        </div>
      </div>

      {error && (
        <p className="text-red-400 text-xs bg-red-400/10 px-3 py-2 rounded-lg border border-red-400/20">
          {error}
        </p>
      )}

      {/* Submit button */}
      <Button
        onClick={handleSubmit}
        disabled={isSubmitting || !answer.trim()}
        className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-semibold h-11"
      >
        {submitState === "grading" && (
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            AI Grading...
          </span>
        )}
        {submitState === "analyzing" && (
          <span className="flex items-center gap-2">
            <Shield size={15} className="animate-pulse" />
            Analyzing Integrity...
          </span>
        )}
        {(submitState === "idle" || submitState === "error") && (
          <span className="flex items-center gap-2">
            <Send size={15} /> Submit Answer
          </span>
        )}
      </Button>

      <p className="text-center text-[11px] text-zinc-600">
        Your editing process is recorded to verify authentic work.
        This is not a plagiarism detector — it tracks how you write.
      </p>
    </div>
  );
}