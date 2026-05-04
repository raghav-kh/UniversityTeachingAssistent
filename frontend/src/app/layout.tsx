"use client";
import "./globals.css";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/ui/Sidebar";
import { getUser } from "@/lib/auth";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-sans",
});

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

  const user = getUser();

  const bodyClass = (!mounted || isPublic || !user)
    ? "bg-gray-950 text-white"
    : cn(
        inter.variable,
        "bg-background text-foreground antialiased font-sans",
        "bg-gradient-to-br from-background via-background to-muted/50"
      );

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={bodyClass} suppressHydrationWarning>
        {(!mounted || isPublic) ? (
          children
        ) : !user ? (
          null
        ) : (
          <div className="flex min-h-screen">
            <aside className="sticky top-0 z-40 hidden h-screen w-64 border-r border-sidebar-border/80 bg-sidebar/90 backdrop-blur lg:block">
              <Sidebar />
            </aside>
            <main className="flex-1 overflow-y-auto">
              {children}
            </main>
          </div>
        )}
      </body>
    </html>
  );
}