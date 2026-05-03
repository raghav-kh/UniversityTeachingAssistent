"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getUser } from "@/lib/auth";
import axios from "axios";
import { PageShell, PageHeader, SurfaceCard } from "@/components/ui/PagePrimitives";

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
    <PageShell>
      <PageHeader
        title="My Grades"
        subtitle={`Welcome, ${userName}`}
        badge="Student · Dashboard"
      />

      {avg && (
        <SurfaceCard className="border-indigo-500/40 bg-indigo-500/5">
          <p className="text-sm text-indigo-200">
            Overall average
          </p>
          <p className="text-3xl font-bold text-foreground">
            {avg}%
          </p>
        </SurfaceCard>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">
          Loading grades…
        </p>
      ) : grades.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No submissions yet.{" "}
          <Link
            href="/student/exam"
            className="font-medium text-primary hover:underline"
          >
            Take an exam →
          </Link>
        </p>
      ) : (
        <section className="space-y-3">
          {grades.map((g, i) => (
            <SurfaceCard key={i}>
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-foreground">
                  {g.assignment_title || `Submission #${g.submission_id}`}
                </p>
                <span
                  className={`text-sm font-semibold ${
                    g.score / g.max_score >= 0.5
                      ? "text-emerald-400"
                      : "text-red-400"
                  }`}
                >
                  {g.score}/{g.max_score}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {g.feedback}
              </p>
              <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
                <span>
                  {new Date(g.graded_at).toLocaleDateString()}
                </span>
                {g.flagged && (
                  <span className="text-amber-400">
                    ⚠ Flagged for review
                  </span>
                )}
              </div>
            </SurfaceCard>
          ))}
        </section>
      )}
    </PageShell>
  );
}