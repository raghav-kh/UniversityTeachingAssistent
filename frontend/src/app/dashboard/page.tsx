"use client";

import { useEffect, useState } from "react";
import StatCard from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/badge";
import { getReviewQueue, getIntegrityReports } from "@/lib/api";

export default function DashboardPage() {
  const [queueCount, setQueueCount]   = useState(0);
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
        setHighRiskCount(reports.filter((r: any) => r.risk_level === "high").length);
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
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">System Overview</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Real-time snapshot of your AI teaching ecosystem
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard
          icon="📝" label="Submissions Graded"
          value="1,247" delta="18% this week" deltaUp
          accent="emerald"
        />
        <StatCard
          icon="⚠️" label="Review Queue"
          value={loading ? "..." : queueCount}
          delta="needs attention" deltaUp={false}
          accent="orange"
        />
        <StatCard
          icon="🛡️" label="High Risk Flags"
          value={loading ? "..." : highRiskCount}
          delta="integrity alerts" deltaUp={false}
          accent="red"
        />
        <StatCard
          icon="💰" label="API Cost Saved"
          value="₹842" delta="68% via T1 + cache" deltaUp
          accent="cyan"
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Activity Feed */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-semibold text-white">Live Activity</h2>
              <p className="text-xs text-zinc-500 mt-0.5">Last 24 hours</p>
            </div>
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>
          </div>

          <div className="space-y-4">
            {feed.map((item, i) => (
              <div key={i} className="flex gap-3">
                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${item.color}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-300 leading-relaxed">
                    {item.text}
                    <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded font-medium ${item.tagColor}`}>
                      {item.tag}
                    </span>
                  </p>
                  <p className="text-[11px] text-zinc-600 mt-0.5">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Model Routing */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="mb-5">
            <h2 className="font-semibold text-white">Model Routing Today</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Smart cost distribution</p>
          </div>

          <div className="space-y-4 mb-6">
            {[
              { label: "Tier-1 LLaMA 3.2 (Local)", pct: 78, color: "bg-emerald-400" },
              { label: "Tier-2 GPT-4o / Gemini",   pct: 22, color: "bg-violet-400" },
            ].map((m) => (
              <div key={m.label}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-zinc-400">{m.label}</span>
                  <span className="text-zinc-300 font-medium">{m.pct}%</span>
                </div>
                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
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
              { val: "971", label: "T1 Requests (Free)", color: "text-emerald-400" },
              { val: "276", label: "T2 Requests (Paid)", color: "text-violet-400" },
            ].map((s) => (
              <div key={s.label} className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700/50">
                <div className={`text-xl font-bold ${s.color}`}>{s.val}</div>
                <div className="text-[11px] text-zinc-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}