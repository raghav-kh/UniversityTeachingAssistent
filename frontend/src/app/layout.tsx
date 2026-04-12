"use client";
import "./globals.css";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/ui/Sidebar";
import { getUser } from "@/lib/auth";
import { useEffect, useState } from "react";

const PUBLIC_ROUTES = ["/login"];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  // Strip trailing slash for public route check (except for root '/')
  const normalizedPath = pathname.endsWith('/') && pathname !== '/' ? pathname.slice(0, -1) : pathname;
  const isPublic = PUBLIC_ROUTES.includes(normalizedPath);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const user = getUser();
    if (!user && !isPublic) {
      router.push('/login');
    }
  }, [pathname, isPublic, router]);

  if (!mounted || isPublic) {
    return (
      <html lang="en">
        <body className="bg-gray-950 text-white" suppressHydrationWarning>
          {children}
        </body>
      </html>
    );
  }

  const user = getUser();
  if (!user) {
    // We already initiated router.push in useEffect above, 
    // just render an empty skeleton while redirecting to avoid flashing content.
    return (
      <html lang="en">
        <body className="bg-gray-950 text-white" suppressHydrationWarning />
      </html>
    );
  }

  return (
    <html lang="en">
      <body className="bg-gray-950 text-white" suppressHydrationWarning>
        {/* Sidebar: fixed on the left, full height */}
        <div className="fixed top-0 left-0 h-screen w-56 z-40">
          <Sidebar />
        </div>
        {/* Main content: offset by sidebar width */}
        <main className="ml-56 min-h-screen overflow-auto">
          {children}
        </main>
      </body>
    </html>
  );
}