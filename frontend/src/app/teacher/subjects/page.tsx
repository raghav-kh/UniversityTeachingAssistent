"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser } from "@/lib/auth";
import { getCourses, createCourse } from "@/lib/api";
import { PageShell, PageHeader, SurfaceCard } from "@/components/ui/PagePrimitives";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
    <PageShell className="max-w-3xl">
      <PageHeader
        title="Subjects"
        subtitle="Manage course shells and subjects"
        badge="Teacher · Subjects"
      />
      <SurfaceCard>
        <h2 className="mb-4 text-base font-semibold text-foreground">Create New Subject</h2>
        <form onSubmit={handleCreate} className="flex gap-3">
          <Input
            placeholder="Course name (e.g. CS101)"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="flex-1"
            required
          />
          <Input
            placeholder="Subject (e.g. Data Structures)"
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            className="flex-1"
            required
          />
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Create"}
          </Button>
        </form>
        {msg && <p className="mt-2 text-sm text-muted-foreground">{msg}</p>}
      </SurfaceCard>
      <div className="grid gap-3">
        {courses.map((c) => (
          <SurfaceCard key={c.id} className="p-4">
            <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-foreground">{c.name}</p>
              <p className="text-sm text-muted-foreground">{c.subject}</p>
            </div>
            <span className="text-xs text-muted-foreground">ID: {c.id}</span>
            </div>
          </SurfaceCard>
        ))}
        {courses.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No subjects yet</p>}
      </div>
    </PageShell>
  );
}