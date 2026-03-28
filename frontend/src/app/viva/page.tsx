"use client";

import { useState } from "react";
import { submitVivaResponse } from "@/lib/api";
import { Mic, Send, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

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
      const res = await submitVivaResponse(parseInt(vivaId), {
        question_index: qIndex,
        response_text: response,
        original_answer: origAnswer,
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
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Micro-Viva</h1>
        <p className="text-zinc-400 text-sm mt-1">
          3-minute targeted oral exam — triggered by integrity flags
        </p>
      </div>

      {/* Setup panel */}
      {questions.length === 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-white">Load a Viva Session</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-500 mb-1.5 block">Viva ID</label>
              <Input
                value={vivaId}
                onChange={e => setVivaId(e.target.value)}
                placeholder="From /integrity/analyze response"
                className="bg-zinc-800 border-zinc-700 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1.5 block">Original Answer (for context)</label>
              <Input
                value={origAnswer}
                onChange={e => setOrigAnswer(e.target.value)}
                placeholder="Paste student's original answer"
                className="bg-zinc-800 border-zinc-700 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1.5 block">
              Paste viva_questions JSON (from /integrity/analyze)
            </label>
            <Textarea
              value={questionsJson}
              onChange={e => setQuestionsJson(e.target.value)}
              placeholder='[{"question":"...","difficulty":"easy","targets":"..."}]'
              className="bg-zinc-800 border-zinc-700 text-sm font-mono min-h-[100px]"
            />
          </div>
          <Button onClick={loadQuestions} className="bg-violet-500 hover:bg-violet-600 text-white">
            <Mic size={15} className="mr-2" /> Start Viva
          </Button>
        </div>
      )}

      {/* Active viva */}
      {questions.length > 0 && !complete && (
        <div className="space-y-4">
          {/* Progress */}
          <div className="flex justify-between text-xs text-zinc-500 mb-1">
            <span>Question {qIndex + 1} of {questions.length}</span>
            <span>{questions[qIndex]?.difficulty} difficulty</span>
          </div>
          <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-violet-400 transition-all"
              style={{ width: `${((qIndex) / questions.length) * 100}%` }}
            />
          </div>

          {/* Question card */}
          <div className="bg-zinc-900 border border-violet-500/30 rounded-xl p-6">
            <div className="flex items-center gap-2 text-xs text-violet-400 mb-3">
              <Mic size={12} /> AI Examiner
            </div>
            <p className="text-white text-lg leading-relaxed font-medium">
              {questions[qIndex]?.question}
            </p>
            <p className="text-xs text-zinc-500 mt-2">
              Tests: {questions[qIndex]?.targets}
            </p>
          </div>

          {/* Response */}
          <Textarea
            value={response}
            onChange={e => setResponse(e.target.value)}
            placeholder="Type student's verbal response here..."
            className="bg-zinc-900 border-zinc-700 text-sm min-h-[120px]"
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
              <div className="text-xs text-zinc-500 uppercase tracking-wider">Previous Responses</div>
              {results.map((r, i) => (
                <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                  <div className="text-xs text-zinc-500 mb-1">Q{i + 1}: {r.question}</div>
                  <div className="flex items-center gap-3">
                    <div className={`text-sm font-bold ${
                      r.evaluation?.understands ? "text-emerald-400" : "text-red-400"
                    }`}>
                      {r.evaluation?.score ?? "?"}/10
                    </div>
                    <div className="text-xs text-zinc-400">{r.evaluation?.feedback}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Completion */}
      {complete && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
          <CheckCircle size={40} className="text-emerald-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Viva Complete</h2>
          <div className={`text-4xl font-bold mb-1 ${
            avgScore >= 7 ? "text-emerald-400" :
            avgScore >= 5 ? "text-amber-400" : "text-red-400"
          }`}>
            {avgScore.toFixed(1)}/10
          </div>
          <div className="text-zinc-500 text-sm mb-6">Average viva score</div>
          <div className="text-xs text-zinc-400 bg-zinc-800 rounded-lg p-3">
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
        </div>
      )}
    </div>
  );
}