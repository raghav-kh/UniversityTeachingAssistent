"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getUser } from "@/lib/auth";

/**
 * RootPage / Home Component
 * Acts as a traffic router to send users to their specific dashboard
 * based on their authenticated role.
 */
export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const user = getUser();

    // 1. If no user session exists, send to login
    if (!user) {
      router.replace("/login");
      return;
    }

    // 2. Role-based Redirection Logic
    switch (user.role) {
      case "admin":
        router.replace("/dashboard");
        break;
      case "teacher":
        router.replace("/teacher/dashboard");
        break;
      case "student":
        router.replace("/student/dashboard");
        break;
      default:
        // Fallback for unexpected roles
        router.replace("/login");
        break;
    }
  }, [router]);

  // Return null as this page is only used for routing logic
  return null;
}