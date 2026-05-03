"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser } from "@/lib/auth";
import { getCourses, createAssignment, getAssignments } from "@/lib/api";
import { PageShell, PageHeader, SurfaceCard } from "@/components/ui/PagePrimitives";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface Course { id: number; name: string; subject: string }
interface Assignment { id: number; title: string; type: string; max_marks: number; course_id: number }

const TYPES = ["mcq", "fill_blank", "true_false", "essay", "descriptive", "code_logic", "reasoning"];

export default function TeacherAssignmentsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [form, setForm] = useState({ course_id: "", title: "", description: "", type: "essay", rubric: "", max_marks: 100 });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const user = getUser();
    if (!user || !["teacher", "admin"].includes(user.role)) {
      router.replace("/login");
      return;
    }
    setReady(true);
    Promise.all([getCourses(), getAssignments()]).then(([c, a]) => {
      setCourses(c);
      setAssignments(a);
    });
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.course_id) return;
    setSaving(true);
    try {
      const a = await createAssignment({ ...form, course_id: Number(form.course_id), max_marks: Number(form.max_marks) });
      setAssignments((p) => [a, ...p]);
      setForm({ course_id: "", title: "", description: "", type: "essay", rubric: "", max_marks: 100 });
      setMsg("Assignment created!");
    } catch {
      setMsg("Failed to create assignment");
    } finally {
      setSaving(false);
    }
  }

  if (!ready) return null;

  return (
    <PageShell className="max-w-4xl">
      <PageHeader
        title="Assignments"
        subtitle="Create and manage grading prompts"
        badge="Teacher · Assignments"
      />
      <SurfaceCard className="space-y-4">
        <h2 className="font-semibold text-foreground">Create Assignment</h2>
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <select value={form.course_id} onChange={(e) => setForm({ ...form, course_id: e.target.value })}
              className="h-10 rounded-lg border border-input bg-background/60 px-3 text-sm text-foreground" required>
              <option value="">Select course…</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.subject}</option>)}
            </select>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="h-10 rounded-lg border border-input bg-background/60 px-3 text-sm text-foreground">
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <Input placeholder="Assignment title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <Textarea placeholder="Description / question" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} required />
          <Textarea placeholder="Rubric (scoring criteria)" value={form.rubric} onChange={(e) => setForm({ ...form, rubric: e.target.value })} rows={3} required />
          <div className="flex items-center gap-3">
            <Input type="number" min={1} max={1000} value={form.max_marks} onChange={(e) => setForm({ ...form, max_marks: Number(e.target.value) })} className="w-28" />
            <label className="text-sm text-muted-foreground">Max marks</label>
            <Button type="submit" disabled={saving} className="ml-auto">
              {saving ? "Saving…" : "Create Assignment"}
            </Button>
          </div>
          {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
        </form>
      </SurfaceCard>
      <div className="space-y-2">
        {assignments.map((a) => (
          <SurfaceCard key={a.id} className="px-4 py-3">
            <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">{a.title}</p>
              <p className="text-xs text-muted-foreground">{a.type} · {a.max_marks} marks · Course #{a.course_id}</p>
            </div>
            <span className="text-xs text-muted-foreground">ID: {a.id}</span>
            </div>
          </SurfaceCard>
        ))}
      </div>
    </PageShell>
  );
}