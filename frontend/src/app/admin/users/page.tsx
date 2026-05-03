"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { listUsers, createUser } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { PageShell, PageHeader, SurfaceCard } from "@/components/ui/PagePrimitives";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface User {
  id: number;
  name: string;
  username: string;
  role: string;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState({ name: "", username: "", password: "", role: "student" });
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const user = getUser();
    if (!user || user.role !== "admin") {
      router.replace("/login");
      return;
    }
    setReady(true);
    listUsers().then(setUsers).catch(console.error);
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setMsg("");
    try {
      const user = await createUser(form);
      setUsers((prev) => [...prev, user]);
      setForm({ name: "", username: "", password: "", role: "student" });
      setMsg(`User "${user.username}" created.`);
    } catch (err: any) {
      setMsg(err?.response?.data?.detail || "Failed to create user");
    } finally {
      setCreating(false);
    }
  }

  if (!ready) return null;

  const roleColors: Record<string, string> = {
    admin: "bg-violet-500/10 text-violet-500",
    teacher: "bg-sky-500/10 text-sky-500",
    student: "bg-emerald-500/10 text-emerald-500",
  };

  return (
    <PageShell className="max-w-4xl">
      <PageHeader title="User Management" subtitle="Create and manage platform users" badge="Admin · Users" />

      <SurfaceCard>
        <h2 className="mb-4 text-lg font-semibold text-foreground">Create User</h2>
        <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
          <Input
            placeholder="Full name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <Input
            placeholder="Username"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            required
          />
          <Input
            placeholder="Password"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="h-10 rounded-lg border border-input bg-background/60 px-3 text-sm text-foreground"
          >
            <option value="student">Student</option>
            <option value="teacher">Teacher</option>
            <option value="admin">Admin</option>
          </select>
          <div className="col-span-2 flex items-center gap-4">
            <Button
              type="submit"
              disabled={creating}
            >
              {creating ? "Creating…" : "Create User"}
            </Button>
            {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
          </div>
        </form>
      </SurfaceCard>

      <SurfaceCard className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/70 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">ID</th>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Username</th>
              <th className="px-4 py-3 text-left">Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-border/70 text-foreground">
                <td className="px-4 py-3 text-muted-foreground">{u.id}</td>
                <td className="px-4 py-3">{u.name}</td>
                <td className="px-4 py-3 font-mono text-primary">{u.username}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${roleColors[u.role]}`}>
                    {u.role}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SurfaceCard>
    </PageShell>
  );
}