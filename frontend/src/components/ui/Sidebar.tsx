"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getUser, clearUser } from "@/lib/auth";
import { useEffect, useState } from "react";

type NavItem = { label: string; href: string };

const ADMIN_NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "User Management", href: "/admin/users" },
  { label: "Router Stats", href: "/router" },
];

const TEACHER_NAV: NavItem[] = [
  { label: "Dashboard", href: "/teacher/dashboard" },
  { label: "Subjects", href: "/teacher/subjects" },
  { label: "Assignments", href: "/teacher/assignments" },
  { label: "Review Queue", href: "/teacher/review" },
  { label: "Integrity", href: "/teacher/integrity" },
  { label: "RAG Upload", href: "/teacher/rag" },
  { label: "Graph", href: "/graph" },
  { label: "Router Stats", href: "/router" },
];

const STUDENT_NAV: NavItem[] = [
  { label: "My Grades", href: "/student/dashboard" },
  { label: "Take Exam", href: "/student/exam" },
  { label: "AI Tutor", href: "/student/tutor" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState(getUser());

  useEffect(() => {
    setUser(getUser());
  }, [pathname]);

  const navItems =
    user?.role === "admin"
      ? ADMIN_NAV
      : user?.role === "teacher"
      ? TEACHER_NAV
      : STUDENT_NAV;

  function handleLogout() {
    clearUser();
    router.push("/login");
  }

  return (
    <aside className="w-56 h-full bg-gray-900 text-white flex flex-col">
      <div className="p-4 border-b border-gray-700">
        <p className="text-lg font-bold text-indigo-400">EduAI</p>
        {user && (
          <p className="text-xs text-gray-400 mt-1">
            {user.name} · <span className="capitalize">{user.role}</span>
          </p>
        )}
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`block px-3 py-2 rounded-md text-sm transition-colors ${
              pathname === item.href
                ? "bg-indigo-600 text-white"
                : "text-gray-300 hover:bg-gray-700"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="p-3 border-t border-gray-700">
        <button
          onClick={handleLogout}
          className="w-full text-left px-3 py-2 rounded-md text-sm text-red-400 hover:bg-gray-700"
        >
          Logout
        </button>
      </div>
    </aside>
  );
}