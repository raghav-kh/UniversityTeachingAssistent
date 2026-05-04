"use client";

import { getUser } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const user = getUser();
    if (!user) {
      router.replace("/login");
      return;
    }

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
        router.replace("/login");
        break;
    }
  }, [router]);

  return null;
}