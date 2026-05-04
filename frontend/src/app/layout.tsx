import "./globals.css";
import ClientLayout from "@/components/ui/ClientLayout";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "EduAI — University Teaching Assistant",
  description: "AI-powered grading, integrity monitoring, and student support platform.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}