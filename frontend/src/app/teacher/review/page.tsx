"use client";

import { useEffect, useState } from "react";
import { getReviewQueue, resolveReview, ReviewQueueItem } from "@/lib/api";
import { CheckCircle, XCircle, Edit, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { PageShell, PageHeader, SurfaceCard } from "@/components/ui/PagePrimitives";

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

  if (loading) {
    return (
      <PageShell className="max-w-3xl">
        <PageHeader
          title="Review Queue"
          subtitle="AI-flagged submissions needing professor review"
          badge="Teacher · Review"
        />
        <SurfaceCard className="flex items-center gap-3 text-muted-foreground">
          <RefreshCw size={16} className="animate-spin" />
          Loading review queue...
        </SurfaceCard>
      </PageShell>
    );
  }

  return (
    <PageShell className="max-w-3xl">
      <PageHeader title="Review Queue" subtitle="AI-flagged submissions needing professor review" badge="Teacher · Review" actions={
        <div className="text-right">
          <div className="text-2xl font-bold text-foreground">{remaining}</div>
          <div className="text-xs text-muted-foreground">remaining</div>
        </div>
      } />
      <div className="mb-4 flex items-start justify-between">
        <div>
          
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
          <span>{done} reviewed today</span>
          <span>{queue.length} total</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-emerald-400 rounded-full transition-all duration-500"
            style={{ width: `${queue.length ? (index / queue.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Empty state */}
      {remaining === 0 && (
        <SurfaceCard className="p-12 text-center">
          <div className="text-4xl mb-3">🎉</div>
          <div className="font-semibold text-foreground">Queue cleared!</div>
          <div className="mt-1 text-sm text-muted-foreground">All submissions reviewed</div>
          <Button onClick={loadQueue} className="mt-4" variant="outline">
            Refresh Queue
          </Button>
        </SurfaceCard>
      )}

      {/* Review Card */}
      {current && (
        <SurfaceCard className="overflow-hidden p-0">
          {/* Card header */}
          <div className="flex items-start justify-between border-b border-border/70 p-5">
            <div>
              <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
                {current.assignment_type} · {current.assignment_title}
              </div>
              <div className="font-semibold text-foreground">{current.student_name}</div>
              <div className="text-xs text-muted-foreground">{current.student_id}</div>
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${priorityColor}`}>
              {current.priority}
            </span>
          </div>

          {/* Student answer */}
          <div className="border-b border-border/70 p-5">
            <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
              Student Answer
            </div>
            <p className="max-h-36 overflow-y-auto rounded-lg border border-border/70 bg-muted p-4 text-sm leading-relaxed text-foreground">
              {current.answer_text}
            </p>
          </div>

          {/* AI grade info */}
          <div className="border-b border-border/70 p-5">
            <div className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">
              AI Assessment
            </div>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="rounded-lg border border-border/70 bg-muted p-3">
                <div className="text-xl font-bold text-foreground">
                  {current.score}/{current.max_score}
                </div>
                <div className="text-[11px] text-muted-foreground">AI Score</div>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted p-3">
                <div className={`text-xl font-bold ${
                  confidencePct >= 85 ? "text-emerald-400" :
                  confidencePct >= 65 ? "text-amber-400" : "text-red-400"
                }`}>
                  {confidencePct}%
                </div>
                <div className="text-[11px] text-muted-foreground">Confidence</div>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted p-3">
                <div className="text-xl font-bold text-violet-400 truncate text-sm pt-1">
                  {current.model_used}
                </div>
                <div className="text-[11px] text-muted-foreground">Model</div>
              </div>
            </div>

            <div className="flex items-start gap-2 p-3 bg-amber-400/5 border border-amber-400/20 rounded-lg">
              <AlertTriangle size={13} className="text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-300">{current.reason}</p>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {current.feedback}
            </p>
          </div>

          {/* Edit mode */}
          {editMode && (
            <div className="space-y-3 border-b border-border/70 bg-muted/60 p-5">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Override Grade
              </div>
              <div className="flex gap-3">
                <div className="w-32">
                  <label className="mb-1 block text-xs text-muted-foreground">
                    New Score (/{current.max_score})
                  </label>
                  <Input
                    type="number"
                    value={newScore}
                    onChange={e => setNewScore(e.target.value)}
                    placeholder={String(current.score)}
                    className="text-sm"
                    min={0} max={current.max_score}
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-muted-foreground">
                    Your Feedback
                  </label>
                  <Input
                    value={profFeedback}
                    onChange={e => setProfFeedback(e.target.value)}
                    placeholder="Add professor feedback..."
                    className="text-sm"
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
                    className="bg-violet-500 text-white hover:bg-violet-600"
              >
                Save Override
              </Button>
            )}
          </div>
        </SurfaceCard>
      )}
    </PageShell>
  );
}