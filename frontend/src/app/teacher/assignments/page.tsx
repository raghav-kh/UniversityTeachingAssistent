"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser } from "@/lib/auth";
import { getCourses, createAssignment, getAssignments } from "@/lib/api";

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
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white">Assignments</h1>
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 space-y-4">
        <h2 className="text-white font-semibold">Create Assignment</h2>
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <select value={form.course_id} onChange={(e) => setForm({ ...form, course_id: e.target.value })}
              className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm" required>
              <option value="">Select course…</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.subject}</option>)}
            </select>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm">
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <input placeholder="Assignment title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm" required />
          <textarea placeholder="Description / question" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm" required />
          <textarea placeholder="Rubric (scoring criteria)" value={form.rubric} onChange={(e) => setForm({ ...form, rubric: e.target.value })}
            rows={3} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm" required />
          <div className="flex items-center gap-3">
            <input type="number" min={1} max={1000} value={form.max_marks} onChange={(e) => setForm({ ...form, max_marks: Number(e.target.value) })}
              className="w-28 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm" />
            <label className="text-gray-400 text-sm">Max marks</label>
            <button type="submit" disabled={saving}
              className="ml-auto bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-sm disabled:opacity-50">
              {saving ? "Saving…" : "Create Assignment"}
            </button>
          </div>
          {msg && <p className="text-sm text-gray-300">{msg}</p>}
        </form>
      </div>
      <div className="space-y-2">
        {assignments.map((a) => (
          <div key={a.id} className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 flex justify-between items-center">
            <div>
              <p className="text-white text-sm font-medium">{a.title}</p>
              <p className="text-gray-400 text-xs">{a.type} · {a.max_marks} marks · Course #{a.course_id}</p>
            </div>
            <span className="text-xs text-gray-500">ID: {a.id}</span>
          </div>
        ))}
      </div>
    </div>
  );
}