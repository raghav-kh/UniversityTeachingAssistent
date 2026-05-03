"use client";

import { useState } from "react";
import { submitVivaResponse } from "@/lib/api";
import { Mic, Send, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { PageShell, PageHeader, SurfaceCard } from "@/components/ui/PagePrimitives";

export default function VivaPage() {
  const [vivaId, setVivaId]       = useState("");
  const [questions, setQuestions] = useState<any[]>([]);
  const [qIndex, setQIndex]       = useState(0);
  const [response, setResponse]   = useState("");
  const [origAnswer, setOrigAnswer] = useState("");
  const [results, setResults]     = useState<any[]>([]);
  const [loading, setLoading]     = useState(false);
  const [complete, setComplete]   = useState(false);

  // In real app: questions come from integrity/analyze response
  // Here we let prof paste them in for demo
  const [questionsJson, setQuestionsJson] = useState("");

  function loadQuestions() {
    try {
      setQuestions(JSON.parse(questionsJson));
      setQIndex(0);
      setResults([]);
      setComplete(false);
    } catch {
      alert("Invalid JSON — paste the viva_questions array from /integrity/analyze");
    }
  }

  async function submitResponse() {
    if (!response.trim() || !vivaId) return;
    setLoading(true);
    try {
      const res = await submitVivaResponse({
        viva_id: parseInt(vivaId),
        question_index: qIndex,
        response: response,
      });
      setResults(r => [...r, { ...res, question: questions[qIndex]?.question }]);
      if (res.viva_complete) {
        setComplete(true);
      } else {
        setQIndex(i => i + 1);
        setResponse("");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const avgScore = results.length
    ? results.reduce((a, r) => a + (r.evaluation?.score ?? 0), 0) / results.length
    : 0;

  return (
    <PageShell className="max-w-3xl">
      <PageHeader
        title="Micro-Viva"
        subtitle="Targeted oral exam triggered by integrity flags"
        badge="Tools · Viva"
      />

      {/* Setup panel */}
      {questions.length === 0 && (
        <SurfaceCard className="space-y-4">
          <h2 className="font-semibold text-foreground">Load a Viva Session</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs text-muted-foreground">Viva ID</label>
              <Input
                value={vivaId}
                onChange={e => setVivaId(e.target.value)}
                placeholder="From /integrity/analyze response"
                className="text-sm"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-muted-foreground">Original Answer (for context)</label>
              <Input
                value={origAnswer}
                onChange={e => setOrigAnswer(e.target.value)}
                placeholder="Paste student's original answer"
                className="text-sm"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-muted-foreground">
              Paste viva_questions JSON (from /integrity/analyze)
            </label>
            <Textarea
              value={questionsJson}
              onChange={e => setQuestionsJson(e.target.value)}
              placeholder='[{"question":"...","difficulty":"easy","targets":"..."}]'
              className="min-h-[100px] font-mono text-sm"
            />
          </div>
          <Button onClick={loadQuestions} className="bg-violet-500 hover:bg-violet-600 text-white">
            <Mic size={15} className="mr-2" /> Start Viva
          </Button>
        </SurfaceCard>
      )}

      {/* Active viva */}
      {questions.length > 0 && !complete && (
        <div className="space-y-4">
          {/* Progress */}
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>Question {qIndex + 1} of {questions.length}</span>
            <span>{questions[qIndex]?.difficulty} difficulty</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-violet-400 transition-all"
              style={{ width: `${((qIndex) / questions.length) * 100}%` }}
            />
          </div>

          {/* Question card */}
          <SurfaceCard className="border-violet-500/30 p-6">
            <div className="flex items-center gap-2 text-xs text-violet-400 mb-3">
              <Mic size={12} /> AI Examiner
            </div>
            <p className="text-lg font-medium leading-relaxed text-foreground">
              {questions[qIndex]?.question}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Tests: {questions[qIndex]?.targets}
            </p>
          </SurfaceCard>

          {/* Response */}
          <Textarea
            value={response}
            onChange={e => setResponse(e.target.value)}
            placeholder="Type student's verbal response here..."
            className="min-h-[120px] text-sm"
          />

          <Button
            onClick={submitResponse}
            disabled={loading || !response.trim()}
            className="w-full bg-violet-500 hover:bg-violet-600 text-white font-semibold"
          >
            {loading ? "Evaluating..." : (
              <span className="flex items-center gap-2">
                <Send size={14} />
                {qIndex < questions.length - 1 ? "Submit & Next Question" : "Submit Final Answer"}
              </span>
            )}
          </Button>

          {/* Previous results */}
          {results.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Previous Responses</div>
              {results.map((r, i) => (
                <div key={i} className="rounded-lg border border-border/70 bg-card p-3">
                  <div className="mb-1 text-xs text-muted-foreground">Q{i + 1}: {r.question}</div>
                  <div className="flex items-center gap-3">
                    <div className={`text-sm font-bold ${
                      r.evaluation?.understands ? "text-emerald-400" : "text-red-400"
                    }`}>
                      {r.evaluation?.score ?? "?"}/10
                    </div>
                    <div className="text-xs text-muted-foreground">{r.evaluation?.feedback}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Completion */}
      {complete && (
        <SurfaceCard className="p-8 text-center">
          <CheckCircle size={40} className="text-emerald-400 mx-auto mb-4" />
          <h2 className="mb-2 text-xl font-bold text-foreground">Viva Complete</h2>
          <div className={`text-4xl font-bold mb-1 ${
            avgScore >= 7 ? "text-emerald-400" :
            avgScore >= 5 ? "text-amber-400" : "text-red-400"
          }`}>
            {avgScore.toFixed(1)}/10
          </div>
          <div className="mb-6 text-sm text-muted-foreground">Average viva score</div>
          <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            {avgScore >= 7
              ? "Student demonstrates solid understanding of their submission."
              : avgScore >= 5
              ? "Partial understanding detected — professor should review."
              : "Student struggled to explain submission — academic concern flagged."}
          </div>
          <Button onClick={() => { setQuestions([]); setQIndex(0); setResults([]); setComplete(false); }}
            className="mt-5" variant="outline">
            Start New Viva
          </Button>
        </SurfaceCard>
      )}
    </PageShell>
  );
}