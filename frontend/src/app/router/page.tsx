"use client";

import { useEffect, useState } from "react";
import { getRouterStats, RouterStats } from "@/lib/api";
import { Zap, RefreshCw, TrendingUp, Shield, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageShell, PageHeader, SurfaceCard } from "@/components/ui/PagePrimitives";

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

  if (loading) {
    return (
      <PageShell className="max-w-5xl">
        <PageHeader
          title="Model Router"
          subtitle="Tier-1/Tier-2 routing with live cost analytics"
          badge="Tools · Router"
        />
        <SurfaceCard className="flex items-center gap-3 text-muted-foreground">
          <RefreshCw size={16} className="animate-spin" />
          Loading stats...
        </SurfaceCard>
      </PageShell>
    );
  }

  if (!stats) {
    return (
      <PageShell className="max-w-5xl">
        <PageHeader
          title="Model Router"
          subtitle="Tier-1/Tier-2 routing with live cost analytics"
          badge="Tools · Router"
          actions={
            <Button
              onClick={load}
              variant="outline"
              className="text-muted-foreground hover:text-foreground"
            >
              <RefreshCw size={14} className="mr-2" />
              Retry
            </Button>
          }
        />
        <SurfaceCard className="text-sm text-muted-foreground">
          Could not load stats — make sure backend is running.
        </SurfaceCard>
      </PageShell>
    );
  }

  const confPct = Math.round(stats.avg_confidence * 100);

  return (
    <PageShell className="max-w-5xl">

      {/* Header */}
      <PageHeader
        title="Model Router"
        subtitle="Tier-1/Tier-2 routing with live cost analytics"
        badge="Tools · Router"
        actions={
          <Button
            onClick={load}
            variant="outline"
            className="text-muted-foreground hover:text-foreground"
          >
            <RefreshCw size={14} className="mr-2" /> Refresh
          </Button>
        }
      />

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
          <SurfaceCard key={s.label} className="relative p-5">
            <div className={`absolute top-0 left-0 right-0 h-0.5 ${s.accent}`} />
            <div className="text-2xl mb-3">{s.icon}</div>
            <div className={`text-2xl font-bold ${s.color}`}>{s.val}</div>
            <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
              {s.label}
            </div>
          </SurfaceCard>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">

        {/* Tier routing breakdown */}
        <SurfaceCard className="p-6">
          <div className="flex items-center gap-2 mb-5">
            <Zap size={16} className="text-emerald-400" />
            <h2 className="font-semibold text-foreground">Tier Distribution</h2>
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
                  <span className="text-muted-foreground">{t.label}</span>
                  <span className={`font-bold ${t.textColor}`}>
                    {t.count} ({t.pct}%)
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${t.color} transition-all duration-1000`}
                    style={{ width: `${t.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Routing logic */}
          <div className="rounded-lg border border-border/70 bg-muted p-3">
            <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              Routing Logic
            </div>
            <div className="font-mono text-[11px] text-cyan-400 leading-relaxed">
              <span className="text-muted-foreground">IF</span> task IN [mcq, fill_blank]
              <span className="text-emerald-400"> → Tier-1</span><br />
              <span className="text-muted-foreground">IF</span> confidence &lt; 0.85
              <span className="text-violet-400"> → Tier-2</span><br />
              <span className="text-muted-foreground">IF</span> task IN [essay, reasoning]
              <span className="text-violet-400"> → Tier-2</span><br />
              <span className="text-muted-foreground">ELSE</span>
              <span className="text-emerald-400"> → Tier-1</span>
            </div>
          </div>
        </SurfaceCard>

        {/* Confidence distribution */}
        <SurfaceCard className="p-6">
          <div className="flex items-center gap-2 mb-5">
            <Brain size={16} className="text-violet-400" />
            <h2 className="font-semibold text-foreground">Confidence Distribution</h2>
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
                    <span className="text-muted-foreground">{c.label}</span>
                    <span className={`font-bold ${c.textColor}`}>
                      {c.count} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
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
            <div className="rounded-lg border border-border/70 bg-muted p-3">
              <div className="text-xl font-bold text-amber-400">
                {stats.flagged_count}
              </div>
              <div className="text-[11px] text-muted-foreground">Sent to Prof Queue</div>
            </div>
            <div className="rounded-lg border border-border/70 bg-muted p-3">
              <div className="text-xl font-bold text-emerald-400">
                {stats.reviewed_by_prof}
              </div>
              <div className="text-[11px] text-muted-foreground">Prof Reviewed</div>
            </div>
          </div>
        </SurfaceCard>
      </div>

      {/* Cost breakdown + model usage */}
      <div className="grid grid-cols-2 gap-6">

        {/* Cost savings */}
        <SurfaceCard className="p-6">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp size={16} className="text-cyan-400" />
            <h2 className="font-semibold text-foreground">Cost Analysis</h2>
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
                color: "text-muted-foreground",
              },
            ].map(s => (
              <div
                key={s.label}
                className="flex items-center justify-between rounded-lg border border-border/70 bg-muted p-3"
              >
                <span className="text-xs text-muted-foreground">{s.label}</span>
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
        </SurfaceCard>

        {/* Model usage breakdown */}
        <SurfaceCard className="p-6">
          <div className="flex items-center gap-2 mb-5">
            <Shield size={16} className="text-orange-400" />
            <h2 className="font-semibold text-foreground">Model Usage</h2>
          </div>

          {stats.model_usage.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
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
                        <span className="max-w-[160px] truncate font-mono text-foreground">
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
                      <span className="font-medium text-muted-foreground">
                        {m.count} ({pct}%)
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
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
          <div className="mt-5 space-y-2 border-t border-border/70 pt-4">
            {[
              { label: "Orchestration", val: "LangChain",       color: "text-cyan-400"    },
              { label: "Local Model",   val: "LLaMA 3.2 3B",    color: "text-emerald-400" },
              { label: "Cloud Model",   val: "GPT-4o (on-demand)", color: "text-violet-400" },
              { label: "Threshold",     val: "85% confidence",  color: "text-amber-400"   },
            ].map(s => (
              <div key={s.label} className="flex justify-between text-xs">
                <span className="text-muted-foreground">{s.label}</span>
                <span className={`font-medium ${s.color}`}>{s.val}</span>
              </div>
            ))}
          </div>
        </SurfaceCard>
      </div>
    </PageShell>
  );
}