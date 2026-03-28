"use client";

import { useEffect, useState } from "react";
import { getIntegrityReports } from "@/lib/api";
import { Shield, RefreshCw, AlertTriangle, CheckCircle } from "lucide-react";

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
  }[level] ?? "text-zinc-400 bg-zinc-400/10 border-zinc-400/20");

  if (loading) return (
    <div className="p-8 flex items-center gap-3 text-zinc-500">
      <RefreshCw size={16} className="animate-spin" /> Loading reports...
    </div>
  );

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Integrity Monitor</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Behavioral analysis — no AI text detectors, pure process tracking
        </p>
      </div>

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
            className={`bg-zinc-900 border rounded-xl p-4 cursor-pointer transition-all ${
              filter === s.level ? "border-zinc-500" : "border-zinc-800 hover:border-zinc-700"
            }`}
          >
            <div className="text-2xl mb-2">{s.icon}</div>
            <div className={`text-2xl font-bold ${s.color}`}>
              {reports.filter(r => r.risk_level === s.level).length}
            </div>
            <div className="text-xs text-zinc-500 mt-0.5">{s.label}</div>
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
                ? "bg-zinc-700 text-white"
                : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {f === "all" ? "All Reports" : `${f} risk`}
          </button>
        ))}
      </div>

      {/* Reports list */}
      {filtered.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
          <Shield size={32} className="text-zinc-700 mx-auto mb-3" />
          <div className="text-zinc-500 text-sm">No reports found</div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r: any) => (
            <div
              key={r.id}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-semibold text-white">{r.student_id}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${riskColor(r.risk_level)}`}>
                      {r.risk_level} risk
                    </span>
                    {r.viva_triggered && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full border text-violet-400 bg-violet-400/10 border-violet-400/20 font-medium">
                        🎤 viva triggered
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-500 mb-3">
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
                        <div className="text-zinc-400 font-medium">{s.val}</div>
                        <div className="text-zinc-600">{s.label}</div>
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
                  <div className="text-[11px] text-zinc-500">risk score</div>
                </div>
              </div>

              {/* Flags */}
              {r.flags && r.flags.length > 0 && (
                <div className="mt-3 pt-3 border-t border-zinc-800 flex flex-wrap gap-2">
                  {r.flags.map((f: any, i: number) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 text-[11px] bg-zinc-800 px-2.5 py-1 rounded-full text-zinc-400"
                    >
                      <AlertTriangle size={9} className="text-amber-400" />
                      {f.type.replace(/_/g, " ")}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}