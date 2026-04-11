"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getUser } from "@/lib/auth";
import { getStudentsStatus, getReviewQueue } from "@/lib/api";
import StatCard from "@/components/ui/StatCard";

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
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-white">Teacher Dashboard</h1>
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total Submissions" value={totalSubs} icon="📝" />
        <StatCard label="Avg Score" value={`${avgScore}%`} icon="📈" />
        <StatCard label="High-Risk Events" value={highRisk} icon="⚠️" />
      </div>
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-700">
          <h2 className="text-white font-semibold">Per-Student Status</h2>
        </div>
        {loading ? (
          <p className="text-gray-400 p-4 text-sm">Loading…</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-700 text-gray-300">
              <tr>
                <th className="px-4 py-2 text-left">Student ID</th>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-right">Submissions</th>
                <th className="px-4 py-2 text-right">Avg Score</th>
                <th className="px-4 py-2 text-right">High-Risk</th>
                <th className="px-4 py-2 text-right">Reviewed</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s, idx) => (
                <tr key={`${s.student_id}-${idx}`} className="border-t border-gray-700 text-white">
                  <td className="px-4 py-2 font-mono text-gray-400">{s.student_id}</td>
                  <td className="px-4 py-2">{s.student_name}</td>
                  <td className="px-4 py-2 text-right">{s.total_submissions}</td>
                  <td className="px-4 py-2 text-right">
                    <span className={Number(s.avg_score) >= 50 ? "text-green-400" : "text-red-400"}>
                      {s.avg_score ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {Number(s.high_risk_count) > 0
                      ? <span className="text-red-400 font-semibold">{s.high_risk_count}</span>
                      : <span className="text-gray-500">0</span>}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-400">{s.reviewed_count}</td>
                </tr>
              ))}
              {students.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-500">No submissions yet</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
      {queue.length > 0 && (
        <div className="bg-yellow-900/20 border border-yellow-700 rounded-xl p-4">
          <p className="text-yellow-400 font-semibold">
            ⚠️ {queue.length} submission{queue.length !== 1 ? "s" : ""} pending review
          </p>
          <Link href="/teacher/review" className="text-sm text-indigo-400 hover:underline mt-1 block">
            Go to Review Queue →
          </Link>
        </div>
      )}
    </div>
  );
}