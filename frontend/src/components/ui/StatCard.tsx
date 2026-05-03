import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  delta?: string;
  deltaUp?: boolean;
  icon: string;
  accent?: "emerald" | "violet" | "orange" | "cyan" | "red";
}

export default function StatCard({
  label,
  value,
  delta,
  deltaUp,
  icon,
  accent = "emerald",
}: StatCardProps) {
  const accentMap: Record<string, string> = {
    emerald: "from-emerald-500/10 border-emerald-500/30",
    violet: "from-violet-500/10 border-violet-500/30",
    orange: "from-orange-500/10 border-orange-500/30",
    cyan: "from-cyan-500/10 border-cyan-500/30",
    red: "from-red-500/10 border-red-500/30",
  };

  const topBarMap: Record<string, string> = {
    emerald: "bg-emerald-400",
    violet: "bg-violet-400",
    orange: "bg-orange-400",
    cyan: "bg-cyan-400",
    red: "bg-red-400",
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-gradient-to-b from-card to-muted/20 p-5 shadow-sm backdrop-blur",
        "transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md",
        accentMap[accent]
      )}
    >
      <div className={cn("absolute inset-x-0 top-0 h-0.5", topBarMap[accent])} />

      <div className="mb-3 text-2xl">{icon}</div>
      <div className="mb-1 text-3xl font-bold tracking-tight text-foreground">
        {value}
      </div>
      <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>

      {delta && (
        <div
          className={cn(
            "mt-2 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
            deltaUp
              ? "bg-emerald-400/10 text-emerald-300"
              : "bg-red-400/10 text-red-300"
          )}
        >
          <span className="mr-1">{deltaUp ? "▲" : "▼"}</span>
          {delta}
        </div>
      )}
    </div>
  );
}