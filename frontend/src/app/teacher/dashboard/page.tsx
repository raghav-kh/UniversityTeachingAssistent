"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getUser } from "@/lib/auth";
import { getStudentsStatus, getReviewQueue } from "@/lib/api";
import StatCard from "@/components/ui/StatCard";
import { PageShell, PageHeader, SurfaceCard } from "@/components/ui/PagePrimitives";

interface StudentRow {
  student_id: string;
  student_name: string;
  total_submissions: number;
  avg_score: number;
  high_risk_count: number;
  reviewed_count: number;
}

export default function TeacherDashboard() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = getUser();
    if (!user || !["teacher", "admin"].includes(user.role)) {
      router.replace("/login");
      return;
    }
    setReady(true);
    Promise.all([getStudentsStatus(), getReviewQueue()])
      .then(([s, q]) => { setStudents(s); setQueue(q); })
      .finally(() => setLoading(false));
  }, []);

  if (!ready) return null;

  const totalSubs = students.reduce((a, s) => a + Number(s.total_submissions), 0);
  const avgScore =
    students.length > 0
      ? (students.reduce((a, s) => a + Number(s.avg_score || 0), 0) / students.length).toFixed(1)
      : "—";
  const highRisk = students.reduce((a, s) => a + Number(s.high_risk_count), 0);

  return (
    <PageShell>
      <PageHeader
        title="Teacher Dashboard"
        subtitle="Live snapshot of your class performance and integrity signals"
        badge="Teacher · Overview"
      />

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Total Submissions" value={totalSubs} icon="📝" />
        <StatCard label="Avg Score" value={`${avgScore}%`} icon="📈" />
        <StatCard label="High-Risk Events" value={highRisk} icon="⚠️" />
      </section>

      <SurfaceCard className="overflow-hidden">
        <div className="border-b border-border/70 px-4 py-3 sm:px-6">
          <h2 className="text-sm font-medium text-foreground">
            Per-Student Status
          </h2>
        </div>
        {loading ? (
          <p className="px-4 py-4 text-sm text-muted-foreground sm:px-6">
            Loading…
          </p>
        ) : (
          <div className="max-h-[480px] overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/60 text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">
                    Student ID
                  </th>
                  <th className="px-4 py-2 text-left font-medium">Name</th>
                  <th className="px-4 py-2 text-right font-medium">
                    Submissions
                  </th>
                  <th className="px-4 py-2 text-right font-medium">
                    Avg Score
                  </th>
                  <th className="px-4 py-2 text-right font-medium">
                    High-Risk
                  </th>
                  <th className="px-4 py-2 text-right font-medium">
                    Reviewed
                  </th>
                </tr>
              </thead>
              <tbody>
                {students.map((s, idx) => (
                  <tr
                    key={`${s.student_id}-${idx}`}
                    className="border-t border-border/60 text-foreground"
                  >
                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                      {s.student_id}
                    </td>
                    <td className="px-4 py-2">{s.student_name}</td>
                    <td className="px-4 py-2 text-right">
                      {s.total_submissions}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <span
                        className={
                          Number(s.avg_score) >= 50
                            ? "text-emerald-400"
                            : "text-red-400"
                        }
                      >
                        {s.avg_score ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      {Number(s.high_risk_count) > 0 ? (
                        <span className="text-red-400 font-semibold">
                          {s.high_risk_count}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right text-muted-foreground">
                      {s.reviewed_count}
                    </td>
                  </tr>
                ))}
                {students.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-6 text-center text-sm text-muted-foreground"
                    >
                      No submissions yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </SurfaceCard>

      {queue.length > 0 && (
        <SurfaceCard className="border-amber-500/40 bg-amber-500/5">
          <p className="text-sm font-semibold text-amber-300">
            ⚠️ {queue.length} submission
            {queue.length !== 1 ? "s" : ""} pending review
          </p>
          <Link
            href="/teacher/review"
            className="mt-1 block text-sm text-primary hover:underline"
          >
            Go to Review Queue →
          </Link>
        </SurfaceCard>
      )}
    </PageShell>
  );
}