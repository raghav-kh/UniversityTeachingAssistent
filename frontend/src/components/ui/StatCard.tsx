import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  delta?: string;
  deltaUp?: boolean;
  icon: string;
  accent?: string;
}

export default function StatCard({
  label, value, delta, deltaUp, icon, accent = "emerald"
}: StatCardProps) {

  const accentMap: Record<string, string> = {
    emerald: "from-emerald-500/20 border-emerald-500/20 after:bg-emerald-400",
    violet:  "from-violet-500/20 border-violet-500/20 after:bg-violet-400",
    orange:  "from-orange-500/20 border-orange-500/20 after:bg-orange-400",
    cyan:    "from-cyan-500/20 border-cyan-500/20 after:bg-cyan-400",
    red:     "from-red-500/20 border-red-500/20 after:bg-red-400",
  };

  const topBarMap: Record<string, string> = {
    emerald: "bg-emerald-400",
    violet:  "bg-violet-400",
    orange:  "bg-orange-400",
    cyan:    "bg-cyan-400",
    red:     "bg-red-400",
  };

  return (
    <div className={cn(
      "relative bg-zinc-900 border border-zinc-800 rounded-xl p-5 overflow-hidden",
      "hover:border-zinc-700 transition-all duration-300"
    )}>
      {/* top accent bar */}
      <div className={cn("absolute top-0 left-0 right-0 h-0.5", topBarMap[accent])} />

      <div className="text-2xl mb-3">{icon}</div>
      <div className="text-3xl font-bold text-white mb-1">{value}</div>
      <div className="text-xs text-zinc-500 uppercase tracking-wider">{label}</div>

      {delta && (
        <div className={cn(
          "text-xs mt-2 font-medium",
          deltaUp ? "text-emerald-400" : "text-red-400"
        )}>
          {deltaUp ? "↑" : "↓"} {delta}
        </div>
      )}
    </div>
  );
}