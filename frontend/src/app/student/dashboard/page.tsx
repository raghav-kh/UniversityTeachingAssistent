"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser } from "@/lib/auth";
import axios from "axios";

interface Grade {
  submission_id: number;
  assignment_title: string;
  score: number;
  max_score: number;
  feedback: string;
  flagged: boolean;
  graded_at: string;
}

export default function StudentDashboard() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [username, setUsername] = useState("");
  const [userName, setUserName] = useState("");
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = getUser();
    if (!user || user.role !== "student") {
      router.replace("/login");
      return;
    }
    setReady(true);
    setUsername(user.username);
    setUserName(user.name);
    axios
      .get(`/grading/student/${user.username}`)
      .then((r) => setGrades(r.data?.grades ?? r.data ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (!ready) return null;

  const avg =
    grades.length > 0
      ? (grades.reduce((a, g) => a + (g.score / g.max_score) * 100, 0) / grades.length).toFixed(1)
      : null;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">My Grades</h1>
        <p className="text-gray-400 text-sm mt-1">Welcome, {userName}</p>
      </div>
      {avg && (
        <div className="bg-indigo-900/30 border border-indigo-700 rounded-xl p-4">
          <p className="text-indigo-300 text-sm">Overall average</p>
          <p className="text-3xl font-bold text-white">{avg}%</p>
        </div>
      )}
      {loading ? (
        <p className="text-gray-400 text-sm">Loading grades…</p>
      ) : grades.length === 0 ? (
        <p className="text-gray-500 text-sm">
          No submissions yet.{" "}
          <a href="/student/exam" className="text-indigo-400 hover:underline">Take an exam →</a>
        </p>
      ) : (
        <div className="space-y-3">
          {grades.map((g, i) => (
            <div key={i} className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-2">
              <div className="flex justify-between items-start">
                <p className="text-white font-medium">{g.assignment_title || `Submission #${g.submission_id}`}</p>
                <span className={`text-sm font-bold ${g.score / g.max_score >= 0.5 ? "text-green-400" : "text-red-400"}`}>
                  {g.score}/{g.max_score}
                </span>
              </div>
              <p className="text-gray-400 text-sm">{g.feedback}</p>
              <div className="flex gap-3 text-xs text-gray-500">
                <span>{new Date(g.graded_at).toLocaleDateString()}</span>
                {g.flagged && <span className="text-yellow-500">⚠ Flagged for review</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}