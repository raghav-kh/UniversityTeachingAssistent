"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser } from "@/lib/auth";
import { getCourses, createCourse } from "@/lib/api";

interface Course { id: number; name: string; subject: string; created_at: string }

export default function TeacherSubjectsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [form, setForm] = useState({ name: "", subject: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const user = getUser();
    if (!user || !["teacher", "admin"].includes(user.role)) {
      router.replace("/login");
      return;
    }
    setReady(true);
    getCourses().then(setCourses).catch(console.error);
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const c = await createCourse(form.name, form.subject);
      setCourses((p) => [c, ...p]);
      setForm({ name: "", subject: "" });
      setMsg("Subject created!");
    } catch {
      setMsg("Failed to create subject");
    } finally {
      setSaving(false);
    }
  }

  if (!ready) return null;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white">Subjects</h1>
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-white font-semibold mb-4">Create New Subject</h2>
        <form onSubmit={handleCreate} className="flex gap-3">
          <input
            placeholder="Course name (e.g. CS101)"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
            required
          />
          <input
            placeholder="Subject (e.g. Data Structures)"
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
            required
          />
          <button type="submit" disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">
            {saving ? "Saving…" : "Create"}
          </button>
        </form>
        {msg && <p className="text-sm text-gray-300 mt-2">{msg}</p>}
      </div>
      <div className="grid gap-3">
        {courses.map((c) => (
          <div key={c.id} className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex justify-between items-center">
            <div>
              <p className="text-white font-semibold">{c.name}</p>
              <p className="text-gray-400 text-sm">{c.subject}</p>
            </div>
            <span className="text-xs text-gray-500">ID: {c.id}</span>
          </div>
        ))}
        {courses.length === 0 && <p className="text-gray-500 text-sm text-center py-6">No subjects yet</p>}
      </div>
    </div>
  );
}