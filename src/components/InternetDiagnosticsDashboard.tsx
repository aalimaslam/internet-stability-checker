"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Clock,
  Globe,
  Info,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Signal,
  Zap,
  Download,
  Trash2,
  Play,
  Square
} from "lucide-react";
import { runInternetDiagnostics } from "@/lib/internetDiagnostics";
import type { InternetDiagnosticsResult } from "@/types/internet";
import { MetricCard } from "./MetricCard";
import { HistoryChart } from "./HistoryChart";
import { GradeDisplay } from "./GradeDisplay";

const MAX_HISTORY_SAMPLES = 60;
const MIN_SESSION_DURATION_SECONDS = 15;
const MAX_SESSION_DURATION_SECONDS = 3600;
const MIN_SAMPLE_INTERVAL_SECONDS = 2;
const MAX_SAMPLE_INTERVAL_SECONDS = 600;

export function InternetDiagnosticsDashboard() {
  const [result, setResult] = useState<InternetDiagnosticsResult | null>(null);
  const [history, setHistory] = useState<InternetDiagnosticsResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [sessionDurationSeconds, setSessionDurationSeconds] = useState(60);
  const [sampleIntervalSeconds, setSampleIntervalSeconds] = useState(10);
  const [sessionEndsAt, setSessionEndsAt] = useState<number | null>(null);
  const [nextSampleAt, setNextSampleAt] = useState<number | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const runningRef = useRef(false);
  const sessionActiveRef = useRef(false);
  const sessionEndRef = useRef(0);
  const sampleIntervalRef = useRef(10);
  const sampleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load history from localStorage on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem("net_diag_history");
    let loadedHistory: InternetDiagnosticsResult[] = [];
    let latestResult: InternetDiagnosticsResult | null = null;

    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        if (Array.isArray(parsed)) {
          loadedHistory = parsed;
          if (parsed.length > 0) {
            latestResult = parsed[parsed.length - 1];
          }
        }
      } catch (e) {
        console.error("Failed to load history", e);
      }
    }

    // Move all state updates into a single microtask to avoid lint error
    // and multiple renders in the same tick.
    Promise.resolve().then(() => {
      if (loadedHistory.length > 0) {
        setHistory(loadedHistory);
      }
      if (latestResult) {
        setResult(latestResult);
      }
      setIsLoaded(true);
    });
  }, []);

  // Save history to localStorage
  useEffect(() => {
    if (isLoaded && history.length > 0) {
      localStorage.setItem("net_diag_history", JSON.stringify(history));
    } else if (isLoaded && history.length === 0) {
      localStorage.removeItem("net_diag_history");
    }
  }, [history, isLoaded]);

  const runCheck = useCallback(async () => {
    if (runningRef.current) return null;

    runningRef.current = true;
    setIsRunning(true);
    setError(null);

    try {
      const output = await runInternetDiagnostics();
      setResult(output);
      setHistory((current) => {
        const updated = [...current.slice(-(MAX_HISTORY_SAMPLES - 1)), output];
        return updated;
      });
      return output;
    } catch (runError) {
      const message = runError instanceof Error ? runError.message : "Unable to complete diagnostics.";
      setError(message);
      return null;
    } finally {
      runningRef.current = false;
      setIsRunning(false);
    }
  }, []);

  const clearTimers = useCallback(() => {
    if (sampleTimerRef.current) clearTimeout(sampleTimerRef.current);
    if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
    sampleTimerRef.current = null;
    sessionTimerRef.current = null;
  }, []);

  const stopSession = useCallback((message?: string) => {
    sessionActiveRef.current = false;
    clearTimers();
    setIsSessionActive(false);
    setSessionEndsAt(null);
    setNextSampleAt(null);
    if (message) setError(message);
  }, [clearTimers]);

  const startSession = useCallback(async () => {
    const sanitizedDuration = Math.min(Math.max(sessionDurationSeconds, MIN_SESSION_DURATION_SECONDS), MAX_SESSION_DURATION_SECONDS);
    const sanitizedInterval = Math.min(Math.max(sampleIntervalSeconds, MIN_SAMPLE_INTERVAL_SECONDS), MAX_SAMPLE_INTERVAL_SECONDS);

    setSessionDurationSeconds(sanitizedDuration);
    setSampleIntervalSeconds(sanitizedInterval);
    setError(null);

    const now = Date.now();
    const endAt = now + sanitizedDuration * 1000;
    sessionEndRef.current = endAt;
    sampleIntervalRef.current = sanitizedInterval;
    sessionActiveRef.current = true;
    setIsSessionActive(true);
    setSessionEndsAt(endAt);

    await runCheck();

    const scheduleSample = (delayMs: number) => {
      sampleTimerRef.current = setTimeout(async () => {
        if (!sessionActiveRef.current) return;
        await runCheck();
        if (!sessionActiveRef.current) return;

        const nextAt = Date.now() + sampleIntervalRef.current * 1000;
        if (nextAt < sessionEndRef.current) {
          setNextSampleAt(nextAt);
          scheduleSample(sampleIntervalRef.current * 1000);
        } else {
          setNextSampleAt(null);
        }
      }, delayMs);
    };

    const firstNextAt = Date.now() + sanitizedInterval * 1000;
    if (firstNextAt < endAt) {
      setNextSampleAt(firstNextAt);
      scheduleSample(sanitizedInterval * 1000);
    }

    sessionTimerRef.current = setTimeout(() => stopSession(), sanitizedDuration * 1000);
  }, [runCheck, sampleIntervalSeconds, sessionDurationSeconds, stopSession]);

  const clearHistory = () => {
    if (confirm("Are you sure you want to clear your test history?")) {
      setHistory([]);
      setResult(null);
      localStorage.removeItem("net_diag_history");
    }
  };

  const exportCSV = () => {
    if (history.length === 0) return;

    const headers = ["Timestamp", "IP", "ISP", "Location", "Grade", "Download (Mbps)", "Upload (Mbps)", "Latency (ms)", "Jitter (ms)", "Packet Loss (%)"];
    const rows = history.map(h => [
      h.sampledAt,
      h.publicIp || "",
      h.isp || "",
      h.location || "",
      h.grade,
      h.downloadMbps,
      h.uploadMbps,
      h.latencyMs,
      h.jitterMs,
      h.packetLossPercent
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `network_diagnostics_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    if (!isSessionActive) return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isSessionActive]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const remainingSeconds = sessionEndsAt ? Math.max(0, Math.ceil((sessionEndsAt - clock) / 1000)) : 0;
  const nextSampleSeconds = nextSampleAt ? Math.max(0, Math.ceil((nextSampleAt - clock) / 1000)) : null;

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900 selection:bg-sky-500/30 dark:bg-zinc-950 dark:text-zinc-100 transition-colors duration-500 pb-20">
      {/* Header / Hero Section */}
      <div className="relative overflow-hidden bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-6 py-12 md:py-20 mb-8">
        <div className="absolute inset-0 bg-grid-zinc-900/[0.02] dark:bg-grid-white/[0.02]" />
        <div className="absolute inset-0 bg-gradient-to-tr from-sky-500/10 via-transparent to-violet-500/10" />

        <div className="relative mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col md:flex-row md:items-end justify-between gap-6"
          >
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-600 dark:text-sky-400 mb-4">
                <Activity size={14} />
                Network Intelligence
              </div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4">
                Internet Stability <span className="bg-gradient-to-r from-sky-500 to-violet-500 bg-clip-text text-transparent">Command Center</span>
              </h1>
              <p className="text-lg text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Professional-grade network diagnostics with real-time stability monitoring,
                intelligent grading, and granular performance metrics.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={runCheck}
                disabled={isRunning}
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-zinc-900 px-6 text-sm font-bold text-white transition-all hover:bg-zinc-800 active:scale-95 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {isRunning ? <RefreshCw className="animate-spin" size={18} /> : <Zap size={18} />}
                Quick Sample
              </button>
              <button
                onClick={isSessionActive ? () => stopSession() : startSession}
                className={`inline-flex h-12 items-center gap-2 rounded-xl border-2 px-6 text-sm font-bold transition-all active:scale-95 ${
                  isSessionActive
                    ? "border-rose-500/20 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20"
                    : "border-sky-500/20 bg-sky-500/10 text-sky-500 hover:bg-sky-500/20"
                }`}
              >
                {isSessionActive ? <Square size={18} /> : <Play size={18} />}
                {isSessionActive ? "Stop Session" : "Start Timed Test"}
              </button>
            </div>
          </motion.div>

          {/* Session Controls / Settings Overlay */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-4 gap-6 items-center p-6 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Duration</label>
              <div className="relative">
                <input
                  type="number"
                  value={sessionDurationSeconds}
                  onChange={(e) => setSessionDurationSeconds(Number(e.target.value))}
                  className="w-full h-10 bg-transparent text-sm font-bold focus:outline-none"
                />
                <span className="absolute right-0 top-1/2 -translate-y-1/2 text-xs text-zinc-400">sec</span>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Interval</label>
              <div className="relative">
                <input
                  type="number"
                  value={sampleIntervalSeconds}
                  onChange={(e) => setSampleIntervalSeconds(Number(e.target.value))}
                  className="w-full h-10 bg-transparent text-sm font-bold focus:outline-none"
                />
                <span className="absolute right-0 top-1/2 -translate-y-1/2 text-xs text-zinc-400">sec</span>
              </div>
            </div>
            <div className="col-span-1 md:col-span-2 flex items-center justify-between pl-4 border-l border-zinc-200 dark:border-zinc-800">
              <div className="flex gap-8">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Time Left</div>
                  <div className="text-xl font-black font-mono">{isSessionActive ? `${remainingSeconds}s` : "--"}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Next Sample</div>
                  <div className="text-xl font-black font-mono text-sky-500">{isSessionActive && nextSampleSeconds !== null ? `${nextSampleSeconds}s` : "--"}</div>
                </div>
              </div>
              <div className="flex gap-2">
                 <button onClick={exportCSV} title="Export CSV" className="p-2 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
                  <Download size={20} />
                 </button>
                 <button onClick={clearHistory} title="Clear History" className="p-2 rounded-lg hover:bg-rose-500/10 text-rose-500 transition-colors">
                  <Trash2 size={20} />
                 </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6">
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-8 overflow-hidden"
            >
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm font-medium text-rose-500 flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                {error}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {result ? (
          <div className="space-y-10">
            {/* Top Row: Grade and Key Metrics */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
              <div className="lg:col-span-4">
                <GradeDisplay
                  grade={result.grade}
                  reason={result.gradeReason}
                  stabilityScore={result.stabilityScore}
                />
              </div>
              <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <MetricCard
                  label="Download Speed"
                  value={`${result.downloadMbps} Mbps`}
                  icon={<ArrowDown className="text-emerald-500" />}
                  tone="highlight"
                  description="Real-time data throughput"
                />
                <MetricCard
                  label="Upload Speed"
                  value={`${result.uploadMbps} Mbps`}
                  icon={<ArrowUp className="text-sky-500" />}
                  tone="highlight"
                  description="Upstream data capacity"
                />
                <MetricCard
                  label="Network Latency"
                  value={`${result.latencyMs} ms`}
                  icon={<Clock className="text-amber-500" />}
                  description="Round-trip response time"
                />
                <MetricCard
                  label="Jitter (Variance)"
                  value={`${result.jitterMs} ms`}
                  icon={<Signal className="text-violet-500" />}
                  description="Delay consistency over time"
                />
              </div>
            </div>

            {/* Middle Row: Network Details & Secondary Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="col-span-1 rounded-2xl border border-black/5 bg-zinc-100/50 p-6 dark:border-white/5 dark:bg-zinc-900/50">
                <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-zinc-500 mb-6">
                  <Globe size={14} /> Connection Identity
                </h3>
                <div className="space-y-4">
                   <div className="flex justify-between items-center">
                    <span className="text-xs text-zinc-500">Public IP</span>
                    <span className="font-mono text-sm font-bold">{result.publicIp || "N/A"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-zinc-500">Service Provider</span>
                    <span className="text-sm font-bold text-right">{result.isp || "N/A"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-zinc-500">Location</span>
                    <span className="flex items-center gap-1 text-sm font-bold">
                      <MapPin size={12} className="text-sky-500" />
                      {result.location || "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="col-span-1 md:col-span-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <MetricCard
                  label="Packet Loss"
                  value={`${result.packetLossPercent}%`}
                  tone={result.packetLossPercent > 1 ? "danger" : "success"}
                />
                <MetricCard
                  label="Success Rate"
                  value={`${result.requestSuccessRatePercent}%`}
                  tone={result.requestSuccessRatePercent < 95 ? "danger" : "success"}
                />
                <MetricCard
                  label="Connection Type"
                  value={result.networkInfo.effectiveType?.toUpperCase() || "N/A"}
                />
                <MetricCard
                  label="Browser RTT"
                  value={result.networkInfo.rttMs ? `${result.networkInfo.rttMs} ms` : "N/A"}
                />
                <MetricCard
                  label="Browser Downlink"
                  value={result.networkInfo.downlinkMbps ? `${result.networkInfo.downlinkMbps} Mbps` : "N/A"}
                />
                <MetricCard
                  label="Data Saver"
                  value={result.networkInfo.saveData ? "Enabled" : "Disabled"}
                />
              </div>
            </div>

            {/* History Charts */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black">Performance Trends</h2>
                <div className="h-px flex-1 mx-6 bg-zinc-200 dark:bg-zinc-800" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                <HistoryChart
                  title="Download Speed"
                  data={history.map(h => ({ value: h.downloadMbps, time: new Date(h.sampledAt).toLocaleTimeString() }))}
                  unit="Mbps"
                  color="#10b981"
                />
                <HistoryChart
                  title="Upload Speed"
                  data={history.map(h => ({ value: h.uploadMbps, time: new Date(h.sampledAt).toLocaleTimeString() }))}
                  unit="Mbps"
                  color="#0ea5e9"
                />
                <HistoryChart
                  title="Latency"
                  data={history.map(h => ({ value: h.latencyMs, time: new Date(h.sampledAt).toLocaleTimeString() }))}
                  unit="ms"
                  color="#f59e0b"
                />
                <HistoryChart
                  title="Jitter"
                  data={history.map(h => ({ value: h.jitterMs, time: new Date(h.sampledAt).toLocaleTimeString() }))}
                  unit="ms"
                  color="#8b5cf6"
                />
                <HistoryChart
                  title="Stability Score"
                  data={history.map(h => ({ value: h.stabilityScore, time: new Date(h.sampledAt).toLocaleTimeString() }))}
                  unit="pts"
                  color="#06b6d4"
                />
                <HistoryChart
                  title="Packet Loss"
                  data={history.map(h => ({ value: h.packetLossPercent, time: new Date(h.sampledAt).toLocaleTimeString() }))}
                  unit="%"
                  color="#f43f5e"
                />
              </div>
            </div>

            {/* Methodology / Explanation */}
            <section className="rounded-3xl bg-zinc-900 text-white p-8 md:p-12 dark:bg-white dark:text-zinc-900 shadow-2xl overflow-hidden relative">
              <div className="absolute top-0 right-0 p-12 opacity-5">
                <ShieldCheck size={200} />
              </div>
              <div className="relative max-w-3xl">
                <h2 className="text-3xl font-black mb-6 flex items-center gap-3">
                  <Info size={32} className="text-sky-500" />
                  Diagnostic Methodology
                </h2>
                <div className="grid gap-8 md:grid-cols-2">
                  <div className="space-y-4">
                    <h3 className="font-bold text-lg border-b border-white/10 dark:border-zinc-900/10 pb-2">Technical Analysis</h3>
                    <p className="text-sm text-zinc-400 dark:text-zinc-500 leading-relaxed">
                      Our system performs sub-millisecond precision pings to multiple endpoints to calculate average latency and jitter.
                      Download and upload speeds are measured through chunked binary data transfers to ensure throughput accuracy.
                    </p>
                  </div>
                  <div className="space-y-4">
                    <h3 className="font-bold text-lg border-b border-white/10 dark:border-zinc-900/10 pb-2">Stability Grading</h3>
                    <p className="text-sm text-zinc-400 dark:text-zinc-500 leading-relaxed">
                      We use a proprietary algorithm that penalizes packet loss and jitter variance heavily, as these are the primary
                      culprits for poor experience in real-time applications like video conferencing and gaming.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl">
            <div className="h-20 w-20 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-6">
              <Activity className="text-zinc-400" size={40} />
            </div>
            <h2 className="text-2xl font-bold mb-2">No Diagnostic Data</h2>
            <p className="text-zinc-500 dark:text-zinc-400 max-w-md">
              Start a diagnostics session or run a quick sample to see your network&apos;s real-time stability and performance.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
