import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { motion } from "framer-motion";

interface HistoryChartProps {
  title: string;
  data: { value: number; time: string }[];
  unit: string;
  color: string;
}

export function HistoryChart({ title, data, unit, color }: HistoryChartProps) {
  const latest = data.at(-1)?.value;
  const min = data.length ? Math.min(...data.map((d) => d.value)) : undefined;
  const max = data.length ? Math.max(...data.map((d) => d.value)) : undefined;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-2xl border border-black/10 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-zinc-900/60"
    >
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
            {title}
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {data.length} samples collected
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            {latest !== undefined ? `${latest.toFixed(1)}` : "--"}
            <span className="ml-1 text-xs font-normal text-zinc-500">
              {unit}
            </span>
          </p>
        </div>
      </header>

      <div className="h-40 w-full">
        {data.length >= 2 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id={`gradient-${title}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="rgba(0,0,0,0.05)"
              />
              <XAxis dataKey="time" hide />
              <YAxis hide domain={["auto", "auto"]} />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded-lg border border-black/10 bg-white p-2 shadow-xl dark:border-white/10 dark:bg-zinc-800">
                        <p className="text-xs font-bold">
                          {payload[0].value} {unit}
                        </p>
                        <p className="text-[10px] text-zinc-500">
                          {payload[0].payload.time}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                fillOpacity={1}
                fill={`url(#gradient-${title})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
            <p className="text-xs text-zinc-400">Collecting data points...</p>
          </div>
        )}
      </div>

      <footer className="mt-4 flex justify-between border-t border-black/5 pt-3 text-[10px] uppercase tracking-wider text-zinc-500 dark:border-white/5 dark:text-zinc-400">
        <div className="flex flex-col">
          <span>Minimum</span>
          <span className="font-bold text-zinc-700 dark:text-zinc-200">
            {min !== undefined ? `${min.toFixed(1)} ${unit}` : "N/A"}
          </span>
        </div>
        <div className="flex flex-col text-right">
          <span>Maximum</span>
          <span className="font-bold text-zinc-700 dark:text-zinc-200">
            {max !== undefined ? `${max.toFixed(1)} ${unit}` : "N/A"}
          </span>
        </div>
      </footer>
    </motion.div>
  );
}
