"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { listUsers, createUser } from "@/lib/api";
import { getUser } from "@/lib/auth";

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
    admin: "bg-purple-900 text-purple-300",
    teacher: "bg-blue-900 text-blue-300",
    student: "bg-green-900 text-green-300",
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-white">User Management</h1>

      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">Create User</h2>
        <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
          <input
            placeholder="Full name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
            required
          />
          <input
            placeholder="Username"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
            required
          />
          <input
            placeholder="Password"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
            required
          />
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
          >
            <option value="student">Student</option>
            <option value="teacher">Teacher</option>
            <option value="admin">Admin</option>
          </select>
          <div className="col-span-2 flex items-center gap-4">
            <button
              type="submit"
              disabled={creating}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create User"}
            </button>
            {msg && <p className="text-sm text-gray-300">{msg}</p>}
          </div>
        </form>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-700 text-gray-300">
            <tr>
              <th className="px-4 py-3 text-left">ID</th>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Username</th>
              <th className="px-4 py-3 text-left">Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-gray-700 text-white">
                <td className="px-4 py-3 text-gray-400">{u.id}</td>
                <td className="px-4 py-3">{u.name}</td>
                <td className="px-4 py-3 font-mono text-indigo-300">{u.username}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${roleColors[u.role]}`}>
                    {u.role}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}