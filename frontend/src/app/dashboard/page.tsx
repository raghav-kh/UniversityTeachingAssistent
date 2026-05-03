"use client";

import { useEffect, useState } from "react";
import StatCard from "@/components/ui/StatCard";
import { getReviewQueue, getIntegrityReports } from "@/lib/api";
import { PageShell, PageHeader, SurfaceCard } from "@/components/ui/PagePrimitives";

export default function DashboardPage() {
  const [queueCount, setQueueCount] = useState(0);
  const [highRiskCount, setHighRiskCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [queue, reports] = await Promise.all([
          getReviewQueue(),
          getIntegrityReports(),
        ]);
        setQueueCount(queue.length);
        setHighRiskCount(
          reports.filter((r: any) => r.risk_level === "high").length
        );
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const feed = [
    { color: "bg-emerald-400", text: "MCQ batch (32 answers) auto-graded via Tier-1 LLaMA", time: "2 min ago", tag: "Tier-1", tagColor: "bg-emerald-400/10 text-emerald-400" },
    { color: "bg-amber-400",   text: "Arjun's essay flagged — confidence 72%", time: "8 min ago", tag: "Flagged", tagColor: "bg-amber-400/10 text-amber-400" },
    { color: "bg-red-400",     text: "Micro-viva triggered for Priya Patel — paste detected", time: "22 min ago", tag: "Viva", tagColor: "bg-red-400/10 text-red-400" },
    { color: "bg-violet-400",  text: "DSA syllabus ingested into RAG — 284 chunks created", time: "1 hr ago", tag: "RAG", tagColor: "bg-violet-400/10 text-violet-400" },
    { color: "bg-cyan-400",    text: "Cache hit — 35 students asked same question, ₹120 saved", time: "2 hrs ago", tag: "Cache", tagColor: "bg-cyan-400/10 text-cyan-400" },
  ];

  return (
    <PageShell>
      <PageHeader
        title="System Overview"
        subtitle="Real-time snapshot of your AI teaching ecosystem"
        badge="Admin · Dashboard"
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon="📝"
          label="Submissions Graded"
          value="1,247"
          delta="18% this week"
          deltaUp
          accent="emerald"
        />
        <StatCard
          icon="⚠️"
          label="Review Queue"
          value={loading ? "…" : queueCount}
          delta="needs attention"
          deltaUp={false}
          accent="orange"
        />
        <StatCard
          icon="🛡️"
          label="High Risk Flags"
          value={loading ? "…" : highRiskCount}
          delta="integrity alerts"
          deltaUp={false}
          accent="red"
        />
        <StatCard
          icon="💰"
          label="API Cost Saved"
          value="₹842"
          delta="68% via T1 + cache"
          deltaUp
          accent="cyan"
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <SurfaceCard>
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-foreground">
                Live Activity
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Last 24 hours
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              Live
            </span>
          </div>
          <div className="space-y-4">
            {feed.map((item, i) => (
              <div key={i} className="flex gap-3">
                <div
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.color}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-relaxed text-foreground/90">
                    {item.text}
                    <span
                      className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-medium ${item.tagColor}`}
                    >
                      {item.tag}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {item.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </SurfaceCard>

        <SurfaceCard>
          <div className="mb-5">
            <h2 className="text-sm font-medium text-foreground">
              Model Routing Today
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Smart cost distribution
            </p>
          </div>

          <div className="mb-6 space-y-4">
            {[
              {
                label: "Tier-1 LLaMA 3.2 (Local)",
                pct: 78,
                color: "bg-emerald-400",
              },
              {
                label: "Tier-2 GPT-4o / Gemini",
                pct: 22,
                color: "bg-violet-400",
              },
            ].map((m) => (
              <div key={m.label}>
                <div className="mb-1.5 flex justify-between text-xs">
                  <span className="text-muted-foreground">{m.label}</span>
                  <span className="font-medium text-foreground">{m.pct}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${m.color} transition-all duration-1000`}
                    style={{ width: `${m.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              {
                val: "971",
                label: "T1 Requests (Free)",
                color: "text-emerald-400",
              },
              {
                val: "276",
                label: "T2 Requests (Paid)",
                color: "text-violet-400",
              },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-lg border border-border/60 bg-background/60 p-3"
              >
                <div className={`text-xl font-bold ${s.color}`}>{s.val}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </SurfaceCard>
      </section>
    </PageShell>
  );
}