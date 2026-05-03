"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getUser, clearUser } from "@/lib/auth";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    setUser(getUser());
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("theme");
    const prefersDark =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initial: "light" | "dark" =
      stored === "light" || stored === "dark"
        ? (stored as "light" | "dark")
        : prefersDark
        ? "dark"
        : "light";
    setTheme(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");
  }, []);

  function toggleTheme() {
    const next: "light" | "dark" = theme === "dark" ? "light" : "dark";
    setTheme(next);
    if (typeof window !== "undefined") {
      document.documentElement.classList.toggle("dark", next === "dark");
      window.localStorage.setItem("theme", next);
    }
  }

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
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="border-b border-sidebar-border/80 px-4 py-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-lg font-semibold tracking-tight text-sidebar-foreground">
              EduAI
            </p>
            {user && (
              <p className="mt-1 text-xs text-sidebar-foreground/70">
                {user.name} ·{" "}
                <span className="capitalize">
                  {user.role}
                </span>
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-sidebar-border/70 bg-sidebar-accent/50 text-[13px] text-sidebar-foreground/80 transition hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/70"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center rounded-xl px-3 py-2.5 text-sm transition",
                active
                  ? "text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground"
              )}
            >
              {active && (
                <span className="pointer-events-none absolute inset-0 rounded-xl bg-sidebar-primary shadow-sm" />
              )}
              <span className="relative z-10">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border/80 px-3 py-3">
        <Button
          onClick={handleLogout}
          variant="outline"
          className="flex w-full items-center justify-between border-sidebar-border/80 bg-transparent text-xs font-medium text-red-500 hover:bg-red-500/10 hover:text-red-500"
        >
          <span>Logout</span>
          <span className="text-[10px] text-red-500/70">
            ⌘K
          </span>
        </Button>
      </div>
    </div>
  );
}