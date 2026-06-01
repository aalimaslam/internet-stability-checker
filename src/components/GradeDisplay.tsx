import { motion } from "framer-motion";

interface GradeDisplayProps {
  grade: string;
  reason: string;
  stabilityScore: number;
}

export function GradeDisplay({
  grade,
  reason,
  stabilityScore,
}: GradeDisplayProps) {
  const getGradeColor = (g: string) => {
    if (g.startsWith("A")) return "text-emerald-500 border-emerald-500/20 bg-emerald-500/5";
    if (g.startsWith("B")) return "text-blue-500 border-blue-500/20 bg-blue-500/5";
    if (g.startsWith("C")) return "text-amber-500 border-amber-500/20 bg-amber-500/5";
    if (g.startsWith("D")) return "text-orange-500 border-orange-500/20 bg-orange-500/5";
    return "text-rose-500 border-rose-500/20 bg-rose-500/5";
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center rounded-3xl border border-black/10 bg-white/40 p-8 text-center backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/40"
    >
      <div
        className={`flex h-24 w-24 items-center justify-center rounded-full border-4 text-4xl font-black shadow-inner ${getGradeColor(
          grade
        )}`}
      >
        {grade}
      </div>
      <h2 className="mt-4 text-2xl font-bold tracking-tight">Overall Health</h2>
      <p className="mt-1 max-w-xs text-sm text-zinc-500 dark:text-zinc-400">
        {reason}
      </p>

      <div className="mt-6 w-full max-w-xs">
        <div className="flex items-center justify-between text-xs font-medium mb-1">
          <span className="text-zinc-500 uppercase tracking-tighter">Stability Score</span>
          <span className="text-zinc-900 dark:text-zinc-100">{stabilityScore}/100</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${stabilityScore}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className={`h-full rounded-full transition-all duration-500 ${
              stabilityScore > 80
                ? "bg-emerald-500"
                : stabilityScore > 50
                ? "bg-amber-500"
                : "bg-rose-500"
            }`}
          />
        </div>
      </div>
    </motion.div>
  );
}
