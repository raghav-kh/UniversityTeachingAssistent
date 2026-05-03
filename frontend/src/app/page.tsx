"use client";

import { getUser } from "@/lib/auth";

/**
 * RootPage / Home Component
 * Acts as a traffic router to send users to their specific dashboard
 * based on their authenticated role.
 *
 * This implementation avoids importing `next/navigation` so it works
 * even in environments where Next's runtime types are not available.
 */
export default function Home() {
  const user = getUser();

  const redirect = (path: string) => {
    if (typeof window !== "undefined") {
      window.location.replace(path);
    }
  };

  // If no user session exists, send to login
  if (!user) {
    redirect("/login");
    return null;
  }

  // Role-based Redirection Logic
  switch (user.role) {
    case "admin":
      redirect("/dashboard");
      break;
    case "teacher":
      redirect("/teacher/dashboard");
      break;
    case "student":
      redirect("/student/dashboard");
      break;
    default:
      redirect("/login");
      break;
  }

  // Return null as this page is only used for routing logic
  return null;
}