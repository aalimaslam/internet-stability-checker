import { motion } from "framer-motion";
import { ReactNode } from "react";

interface MetricCardProps {
  label: string;
  value: string | number | undefined;
  icon?: ReactNode;
  tone?: "neutral" | "highlight" | "danger" | "success";
  description?: string;
}

export function MetricCard({
  label,
  value,
  icon,
  tone = "neutral",
  description,
}: MetricCardProps) {
  const toneClasses = {
    neutral: "border-black/10 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-zinc-900/60",
    highlight: "border-sky-300/70 bg-gradient-to-br from-sky-500/10 to-violet-500/10 dark:border-sky-500/40",
    danger: "border-red-300/70 bg-red-500/5 dark:border-red-500/40",
    success: "border-emerald-300/70 bg-emerald-500/5 dark:border-emerald-500/40",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden rounded-2xl border p-5 shadow-sm transition-all duration-300 hover:shadow-md ${toneClasses[tone]}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {label}
          </dt>
          <dd className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {value ?? "N/A"}
          </dd>
          {description && (
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {description}
            </p>
          )}
        </div>
        {icon && (
          <div className="rounded-lg bg-zinc-100 p-2 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
            {icon}
          </div>
        )}
      </div>
    </motion.div>
  );
}
