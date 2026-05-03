"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface PageShellProps {
  children: React.ReactNode;
  className?: string;
}

export function PageShell({ children, className }: PageShellProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/60">
      <div
        className={cn(
          "mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 lg:px-8",
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string;
  actions?: React.ReactNode;
}

export function PageHeader({
  title,
  subtitle,
  badge,
  actions,
}: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card/70 p-5 shadow-sm sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-muted/70 px-3 py-1 text-xs text-muted-foreground shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          {badge ?? "EduAI"}
        </div>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex items-center gap-2 sm:self-end">{actions}</div>
      ) : null}
    </header>
  );
}

interface SurfaceCardProps {
  children: React.ReactNode;
  className?: string;
}

export function SurfaceCard({ children, className }: SurfaceCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border/70 bg-card/80 shadow-sm backdrop-blur",
        "transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
      <div className="p-5 sm:p-6">{children}</div>
    </div>
  );
}

