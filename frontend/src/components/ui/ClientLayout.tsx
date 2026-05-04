"use client";

import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/ui/Sidebar";
import { getUser } from "@/lib/auth";
import { useEffect, useState } from "react";

const PUBLIC_ROUTES = ["/login", "/login/"];

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // Strip basePath prefix so PUBLIC_ROUTES comparison works on GitHub Pages too
  const strippedPath = pathname.replace(/^\/UniversityTeachingAssistent/, "") || "/";
  const normalizedPath =
    strippedPath.endsWith("/") && strippedPath !== "/"
      ? strippedPath.slice(0, -1)
      : strippedPath;
  const isPublic = PUBLIC_ROUTES.some((r) => r.startsWith(normalizedPath));

  useEffect(() => {
    setMounted(true);
    const user = getUser();
    if (!user && !isPublic) {
      router.replace("/login");
    }
  }, [pathname, isPublic, router]);

  // Avoid flash: don't render authenticated shell until mounted
  if (!mounted) {
    return <>{children}</>;
  }

  const user = getUser();

  if (isPublic || !user) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 z-40 hidden h-screen w-64 shrink-0 border-r border-sidebar-border/80 bg-sidebar/90 backdrop-blur lg:block">
        <Sidebar />
      </aside>
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
