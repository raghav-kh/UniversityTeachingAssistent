"use client";

import { useEffect, useState } from "react";
import { getIntegrityReports } from "@/lib/api";
import { Shield, RefreshCw, AlertTriangle, CheckCircle } from "lucide-react";
import { PageShell, PageHeader, SurfaceCard } from "@/components/ui/PagePrimitives";

export default function IntegrityPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<string>("all");

  useEffect(() => {
    async function load() {
      try {
        const data = await getIntegrityReports();
        setReports(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = filter === "all"
    ? reports
    : reports.filter(r => r.risk_level === filter);

  const riskColor = (level: string) => ({
    high:   "text-red-400 bg-red-400/10 border-red-400/20",
    medium: "text-amber-400 bg-amber-400/10 border-amber-400/20",
    low:    "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  }[level] ?? "text-muted-foreground bg-muted border-border");

  if (loading) {
    return (
      <PageShell className="max-w-5xl">
        <PageHeader
          title="Integrity Monitor"
          subtitle="Behavioral analysis without AI text detectors"
          badge="Teacher · Integrity"
        />
        <SurfaceCard className="flex items-center gap-3 text-muted-foreground">
          <RefreshCw size={16} className="animate-spin" />
          Loading reports...
        </SurfaceCard>
      </PageShell>
    );
  }

  return (
    <PageShell className="max-w-5xl">
      <PageHeader
        title="Integrity Monitor"
        subtitle="Behavioral analysis without AI text detectors"
        badge="Teacher · Integrity"
      />

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "High Risk",   level: "high",   color: "text-red-400",     icon: "🚨" },
          { label: "Medium Risk", level: "medium", color: "text-amber-400",   icon: "⚠️" },
          { label: "Low Risk",    level: "low",    color: "text-emerald-400", icon: "✅" },
        ].map(s => (
          <div
            key={s.level}
            onClick={() => setFilter(filter === s.level ? "all" : s.level)}
            className={`rounded-xl border bg-card p-4 transition-all ${
              filter === s.level ? "border-primary/60" : "border-border/70 hover:border-primary/40"
            }`}
          >
            <div className="text-2xl mb-2">{s.icon}</div>
            <div className={`text-2xl font-bold ${s.color}`}>
              {reports.filter(r => r.risk_level === s.level).length}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 mb-5">
        {["all", "high", "medium", "low"].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all capitalize ${
              filter === f
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {f === "all" ? "All Reports" : `${f} risk`}
          </button>
        ))}
      </div>

      {/* Reports list */}
      {filtered.length === 0 ? (
        <SurfaceCard className="p-12 text-center">
          <Shield size={32} className="mx-auto mb-3 text-muted-foreground" />
          <div className="text-sm text-muted-foreground">No reports found</div>
        </SurfaceCard>
      ) : (
        <div className="space-y-3">
          {filtered.map((r: any) => (
            <SurfaceCard
              key={r.id}
              className="p-5 transition-all hover:border-primary/40"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-semibold text-foreground">{r.student_id}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${riskColor(r.risk_level)}`}>
                      {r.risk_level} risk
                    </span>
                    {r.viva_triggered && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full border text-violet-400 bg-violet-400/10 border-violet-400/20 font-medium">
                        🎤 viva triggered
                      </span>
                    )}
                  </div>
                  <div className="mb-3 text-xs text-muted-foreground">
                    {r.assignment_title}
                  </div>

                  {/* Stats row */}
                  <div className="flex gap-4 text-xs">
                    {[
                      { label: "Time",     val: `${r.total_time_secs}s` },
                      { label: "Pastes",   val: r.paste_count },
                      { label: "Keystrokes", val: r.keystroke_count },
                      { label: "Edits",    val: r.revision_count },
                      { label: "Tab switches", val: r.focus_loss_count },
                    ].map(s => (
                      <div key={s.label}>
                        <div className="font-medium text-foreground">{s.val}</div>
                        <div className="text-muted-foreground">{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Risk score gauge */}
                <div className="text-center flex-shrink-0">
                  <div className={`text-3xl font-bold ${
                    r.risk_score >= 0.7 ? "text-red-400" :
                    r.risk_score >= 0.4 ? "text-amber-400" : "text-emerald-400"
                  }`}>
                    {Math.round(r.risk_score * 100)}
                  </div>
                  <div className="text-[11px] text-muted-foreground">risk score</div>
                </div>
              </div>

              {/* Flags */}
              {r.flags && r.flags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-border/70 pt-3">
                  {r.flags.map((f: any, i: number) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground"
                    >
                      <AlertTriangle size={9} className="text-amber-400" />
                      {f.type.replace(/_/g, " ")}
                    </div>
                  ))}
                </div>
              )}
            </SurfaceCard>
          ))}
        </div>
      )}
    </PageShell>
  );
}