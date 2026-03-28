"use client";

import { useEffect, useState } from "react";
import { getReviewQueue, resolveReview, ReviewQueueItem } from "@/lib/api";
import { CheckCircle, XCircle, Edit, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

export default function ReviewPage() {
  const [queue, setQueue]       = useState<ReviewQueueItem[]>([]);
  const [index, setIndex]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [acting, setActing]     = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [newScore, setNewScore] = useState("");
  const [profFeedback, setProfFeedback] = useState("");
  const [done, setDone]         = useState(0);

  useEffect(() => { loadQueue(); }, []);

  async function loadQueue() {
    setLoading(true);
    try {
      const data = await getReviewQueue();
      setQueue(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function act(action: "approve" | "override") {
    if (!current) return;
    setActing(true);
    try {
      await resolveReview(
        current.queue_id, action,
        action === "override" ? parseFloat(newScore) : undefined,
        action === "override" ? profFeedback : undefined
      );
      setDone(d => d + 1);
      setIndex(i => i + 1);
      setEditMode(false);
      setNewScore("");
      setProfFeedback("");
    } catch (e) {
      console.error(e);
    } finally {
      setActing(false);
    }
  }

  const current = queue[index];
  const remaining = queue.length - index;
  const confidencePct = current ? Math.round(current.confidence * 100) : 0;
  const priorityColor = current?.priority === "urgent"
    ? "text-red-400 bg-red-400/10 border-red-400/20"
    : "text-amber-400 bg-amber-400/10 border-amber-400/20";

  if (loading) return (
    <div className="p-8 flex items-center gap-3 text-zinc-500">
      <RefreshCw size={16} className="animate-spin" /> Loading review queue...
    </div>
  );

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Review Queue</h1>
          <p className="text-zinc-400 text-sm mt-1">
            AI-flagged submissions needing professor review
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-white">{remaining}</div>
          <div className="text-xs text-zinc-500">remaining</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex justify-between text-xs text-zinc-500 mb-1.5">
          <span>{done} reviewed today</span>
          <span>{queue.length} total</span>
        </div>
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-400 rounded-full transition-all duration-500"
            style={{ width: `${queue.length ? (index / queue.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Empty state */}
      {remaining === 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
          <div className="text-4xl mb-3">🎉</div>
          <div className="text-white font-semibold">Queue cleared!</div>
          <div className="text-zinc-500 text-sm mt-1">All submissions reviewed</div>
          <Button onClick={loadQueue} className="mt-4" variant="outline">
            Refresh Queue
          </Button>
        </div>
      )}

      {/* Review Card */}
      {current && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          {/* Card header */}
          <div className="p-5 border-b border-zinc-800 flex items-start justify-between">
            <div>
              <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
                {current.assignment_type} · {current.assignment_title}
              </div>
              <div className="font-semibold text-white">{current.student_name}</div>
              <div className="text-xs text-zinc-500">{current.student_id}</div>
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${priorityColor}`}>
              {current.priority}
            </span>
          </div>

          {/* Student answer */}
          <div className="p-5 border-b border-zinc-800">
            <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
              Student Answer
            </div>
            <p className="text-sm text-zinc-300 leading-relaxed bg-zinc-800/50 p-4 rounded-lg border border-zinc-700/30 max-h-36 overflow-y-auto">
              {current.answer_text}
            </p>
          </div>

          {/* AI grade info */}
          <div className="p-5 border-b border-zinc-800">
            <div className="text-xs text-zinc-500 uppercase tracking-wider mb-3">
              AI Assessment
            </div>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700/30">
                <div className="text-xl font-bold text-white">
                  {current.score}/{current.max_score}
                </div>
                <div className="text-[11px] text-zinc-500">AI Score</div>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700/30">
                <div className={`text-xl font-bold ${
                  confidencePct >= 85 ? "text-emerald-400" :
                  confidencePct >= 65 ? "text-amber-400" : "text-red-400"
                }`}>
                  {confidencePct}%
                </div>
                <div className="text-[11px] text-zinc-500">Confidence</div>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700/30">
                <div className="text-xl font-bold text-violet-400 truncate text-sm pt-1">
                  {current.model_used}
                </div>
                <div className="text-[11px] text-zinc-500">Model</div>
              </div>
            </div>

            <div className="flex items-start gap-2 p-3 bg-amber-400/5 border border-amber-400/20 rounded-lg">
              <AlertTriangle size={13} className="text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-300">{current.reason}</p>
            </div>

            <p className="text-sm text-zinc-400 mt-3 leading-relaxed">
              {current.feedback}
            </p>
          </div>

          {/* Edit mode */}
          {editMode && (
            <div className="p-5 border-b border-zinc-800 bg-zinc-800/30 space-y-3">
              <div className="text-xs text-zinc-400 uppercase tracking-wider">
                Override Grade
              </div>
              <div className="flex gap-3">
                <div className="w-32">
                  <label className="text-xs text-zinc-500 mb-1 block">
                    New Score (/{current.max_score})
                  </label>
                  <Input
                    type="number"
                    value={newScore}
                    onChange={e => setNewScore(e.target.value)}
                    placeholder={String(current.score)}
                    className="bg-zinc-800 border-zinc-700 text-sm"
                    min={0} max={current.max_score}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-zinc-500 mb-1 block">
                    Your Feedback
                  </label>
                  <Input
                    value={profFeedback}
                    onChange={e => setProfFeedback(e.target.value)}
                    placeholder="Add professor feedback..."
                    className="bg-zinc-800 border-zinc-700 text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="p-5 flex items-center gap-3">
            <Button
              onClick={() => act("approve")}
              disabled={acting}
              className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold"
            >
              <CheckCircle size={15} className="mr-2" />
              Approve AI Grade
            </Button>
            <Button
              onClick={() => setEditMode(!editMode)}
              variant="outline"
              className="border-amber-500/50 text-amber-400 hover:bg-amber-400/10"
            >
              <Edit size={15} className="mr-1" />
              Edit
            </Button>
            {editMode && (
              <Button
                onClick={() => act("override")}
                disabled={acting || !newScore}
                className="bg-violet-500 hover:bg-violet-600 text-white font-semibold"
              >
                Save Override
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}