"use client";

import { useEffect, useState } from "react";
import { getRouterStats, RouterStats } from "@/lib/api";
import { Zap, RefreshCw, TrendingUp, Shield, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function RouterPage() {
  const [stats, setStats]   = useState<RouterStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await getRouterStats();
      if (!data.cost_estimate) {
      data.cost_estimate = {
        tier2_spent_inr: 0,
        saved_by_tier1_inr: 0,
        total_if_all_t2_inr: 0,
      };
    }
    if (!data.confidence_distribution) {
      data.confidence_distribution = { high: 0, medium: 0, low: 0 };
    }

    if (!data.model_usage) {
      data.model_usage = [];
    }
      setStats(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return (
    <div className="p-8 flex items-center gap-3 text-zinc-500">
      <RefreshCw size={16} className="animate-spin" /> Loading stats...
    </div>
  );

  if (!stats) return (
    <div className="p-8 text-zinc-500 text-sm">
      Could not load stats — make sure backend is running.
    </div>
  );

  const confPct = Math.round(stats.avg_confidence * 100);

  return (
    <div className="p-8 max-w-5xl">

      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Model Router</h1>
          <p className="text-zinc-400 text-sm mt-1">
            LangChain-powered Tier-1 / Tier-2 routing — live cost analytics
          </p>
        </div>
        <Button
          onClick={load}
          variant="outline"
          className="border-zinc-700 text-zinc-400 hover:text-white"
        >
          <RefreshCw size={14} className="mr-2" /> Refresh
        </Button>
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          {
            icon: "📝", label: "Total Graded",
            val: stats.total_grades, color: "text-white",
            accent: "bg-emerald-400"
          },
          {
            icon: "⚡", label: "Avg Confidence",
            val: `${confPct}%`,
            color: confPct >= 85 ? "text-emerald-400" : confPct >= 65 ? "text-amber-400" : "text-red-400",
            accent: "bg-violet-400"
          },
          {
            icon: "⚠️", label: "Flagged",
            val: `${stats.flagged_count} (${stats.flagged_pct}%)`,
            color: "text-amber-400",
            accent: "bg-orange-400"
          },
          {
            icon: "💰", label: "Saved via T1",
            val: `₹${stats.cost_estimate.saved_by_tier1_inr}`,
            color: "text-cyan-400",
            accent: "bg-cyan-400"
          },
        ].map(s => (
          <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 relative overflow-hidden">
            <div className={`absolute top-0 left-0 right-0 h-0.5 ${s.accent}`} />
            <div className="text-2xl mb-3">{s.icon}</div>
            <div className={`text-2xl font-bold ${s.color}`}>{s.val}</div>
            <div className="text-xs text-zinc-500 uppercase tracking-wider mt-1">
              {s.label}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">

        {/* Tier routing breakdown */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <Zap size={16} className="text-emerald-400" />
            <h2 className="font-semibold text-white">Tier Distribution</h2>
          </div>

          <div className="space-y-4 mb-6">
            {[
              {
                label: "Tier-1 · LLaMA 3.2 (Local · Free)",
                count: stats.tier1_count,
                pct: stats.tier1_pct,
                color: "bg-emerald-400",
                textColor: "text-emerald-400",
              },
              {
                label: "Tier-2 · GPT-4o / Gemini (Cloud · Paid)",
                count: stats.tier2_count,
                pct: stats.tier2_pct,
                color: "bg-violet-400",
                textColor: "text-violet-400",
              },
            ].map(t => (
              <div key={t.label}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-zinc-400">{t.label}</span>
                  <span className={`font-bold ${t.textColor}`}>
                    {t.count} ({t.pct}%)
                  </span>
                </div>
                <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${t.color} transition-all duration-1000`}
                    style={{ width: `${t.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Routing logic */}
          <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700/30">
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">
              Routing Logic
            </div>
            <div className="font-mono text-[11px] text-cyan-400 leading-relaxed">
              <span className="text-zinc-500">IF</span> task IN [mcq, fill_blank]
              <span className="text-emerald-400"> → Tier-1</span><br />
              <span className="text-zinc-500">IF</span> confidence &lt; 0.85
              <span className="text-violet-400"> → Tier-2</span><br />
              <span className="text-zinc-500">IF</span> task IN [essay, reasoning]
              <span className="text-violet-400"> → Tier-2</span><br />
              <span className="text-zinc-500">ELSE</span>
              <span className="text-emerald-400"> → Tier-1</span>
            </div>
          </div>
        </div>

        {/* Confidence distribution */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <Brain size={16} className="text-violet-400" />
            <h2 className="font-semibold text-white">Confidence Distribution</h2>
          </div>

          <div className="space-y-3 mb-6">
            {[
              {
                label: "High (≥85%) — Auto-approved",
                count: stats.confidence_distribution.high,
                total: stats.total_grades,
                color: "bg-emerald-400",
                textColor: "text-emerald-400",
              },
              {
                label: "Medium (65-84%) — Escalated",
                count: stats.confidence_distribution.medium,
                total: stats.total_grades,
                color: "bg-amber-400",
                textColor: "text-amber-400",
              },
              {
                label: "Low (<65%) — Prof Review",
                count: stats.confidence_distribution.low,
                total: stats.total_grades,
                color: "bg-red-400",
                textColor: "text-red-400",
              },
            ].map(c => {
              const pct = Math.round(c.count / Math.max(c.total, 1) * 100);
              return (
                <div key={c.label}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-zinc-400">{c.label}</span>
                    <span className={`font-bold ${c.textColor}`}>
                      {c.count} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${c.color} transition-all duration-1000`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* HITL stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700/30">
              <div className="text-xl font-bold text-amber-400">
                {stats.flagged_count}
              </div>
              <div className="text-[11px] text-zinc-500">Sent to Prof Queue</div>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700/30">
              <div className="text-xl font-bold text-emerald-400">
                {stats.reviewed_by_prof}
              </div>
              <div className="text-[11px] text-zinc-500">Prof Reviewed</div>
            </div>
          </div>
        </div>
      </div>

      {/* Cost breakdown + model usage */}
      <div className="grid grid-cols-2 gap-6">

        {/* Cost savings */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp size={16} className="text-cyan-400" />
            <h2 className="font-semibold text-white">Cost Analysis</h2>
          </div>

          <div className="space-y-3 mb-4">
            {[
              {
                label: "Spent on Tier-2 (cloud)",
                val: `₹${stats.cost_estimate.tier2_spent_inr}`,
                color: "text-red-400",
              },
              {
                label: "Saved by using Tier-1",
                val: `₹${stats.cost_estimate.saved_by_tier1_inr}`,
                color: "text-emerald-400",
              },
              {
                label: "Cost if all were Tier-2",
                val: `₹${stats.cost_estimate.total_if_all_t2_inr}`,
                color: "text-zinc-400",
              },
            ].map(s => (
              <div
                key={s.label}
                className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/30"
              >
                <span className="text-xs text-zinc-400">{s.label}</span>
                <span className={`text-sm font-bold ${s.color}`}>{s.val}</span>
              </div>
            ))}
          </div>

          {/* Savings percentage */}
          {stats.cost_estimate.total_if_all_t2_inr > 0 && (
            <div className="bg-emerald-400/10 border border-emerald-400/20 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-emerald-400">
                {Math.round(
                  stats.cost_estimate.saved_by_tier1_inr /
                  stats.cost_estimate.total_if_all_t2_inr * 100
                )}%
              </div>
              <div className="text-xs text-emerald-400/70 mt-0.5">
                total cost reduction via smart routing
              </div>
            </div>
          )}
        </div>

        {/* Model usage breakdown */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <Shield size={16} className="text-orange-400" />
            <h2 className="font-semibold text-white">Model Usage</h2>
          </div>

          {stats.model_usage.length === 0 ? (
            <div className="text-zinc-600 text-sm text-center py-8">
              No grading data yet — submit some answers first
            </div>
          ) : (
            <div className="space-y-3">
              {stats.model_usage.map((m, i) => {
                const pct = Math.round(m.count / stats.total_grades * 100);
                const isLocal = m.model_used.includes("llama") ||
                                m.model_used.includes("keyword") ||
                                m.model_used.includes("fallback");
                return (
                  <div key={i}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          isLocal ? "bg-emerald-400" : "bg-violet-400"
                        }`} />
                        <span className="text-zinc-300 font-mono truncate max-w-[160px]">
                          {m.model_used}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          isLocal
                            ? "bg-emerald-400/10 text-emerald-400"
                            : "bg-violet-400/10 text-violet-400"
                        }`}>
                          {isLocal ? "local" : "cloud"}
                        </span>
                      </div>
                      <span className="text-zinc-400 font-medium">
                        {m.count} ({pct}%)
                      </span>
                    </div>
                    <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ${
                          isLocal ? "bg-emerald-400" : "bg-violet-400"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Stack info */}
          <div className="mt-5 pt-4 border-t border-zinc-800 space-y-2">
            {[
              { label: "Orchestration", val: "LangChain",       color: "text-cyan-400"    },
              { label: "Local Model",   val: "LLaMA 3.2 3B",    color: "text-emerald-400" },
              { label: "Cloud Model",   val: "GPT-4o (on-demand)", color: "text-violet-400" },
              { label: "Threshold",     val: "85% confidence",  color: "text-amber-400"   },
            ].map(s => (
              <div key={s.label} className="flex justify-between text-xs">
                <span className="text-zinc-500">{s.label}</span>
                <span className={`font-medium ${s.color}`}>{s.val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}