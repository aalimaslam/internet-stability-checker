"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { runInternetDiagnostics } from "@/lib/internetDiagnostics";
import type { InternetDiagnosticsResult } from "@/types/internet";

type Explanation = {
  label: string;
  layman: string;
  technical: string;
  value: string;
};

function metricCard(
  label: string,
  value: string | number | undefined,
  tone: "neutral" | "highlight" = "neutral",
) {
  return (
    <div
      className={`rounded-xl border p-4 shadow-sm ${
        tone === "highlight"
          ? "border-sky-300/70 bg-gradient-to-br from-sky-500/10 to-violet-500/10 dark:border-sky-500/40"
          : "border-black/10 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-zinc-950/60"
      }`}
    >
      <dt className="text-sm text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="mt-1 text-xl font-semibold">{value ?? "N/A"}</dd>
    </div>
  );
}

function chartPath(values: number[]) {
  if (values.length < 2) {
    return "";
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 100 - ((value - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(" ");
}

function lineChart(
  title: string,
  unit: string,
  values: number[],
  colorClassName: string,
) {
  const latest = values.at(-1);
  const min = values.length ? Math.min(...values) : undefined;
  const max = values.length ? Math.max(...values) : undefined;
  const path = chartPath(values);

  return (
    <article className="rounded-xl border border-black/10 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-zinc-950/60">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
          {title}
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {latest !== undefined ? `${latest.toFixed(2)} ${unit}` : "Waiting..."}
        </p>
      </header>
      <div className="h-28 rounded-lg bg-zinc-100/70 p-2 dark:bg-zinc-900/70">
        {path ? (
          <svg viewBox="0 0 100 100" className="h-full w-full" preserveAspectRatio="none">
            <polyline
              fill="none"
              strokeWidth="2.5"
              points={path}
              className={colorClassName}
            />
          </svg>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-zinc-500 dark:text-zinc-400">
            Need at least two samples.
          </div>
        )}
      </div>
      <footer className="mt-3 flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
        <span>Min: {min !== undefined ? `${min.toFixed(2)} ${unit}` : "N/A"}</span>
        <span>Max: {max !== undefined ? `${max.toFixed(2)} ${unit}` : "N/A"}</span>
      </footer>
    </article>
  );
}

export function InternetDiagnosticsDashboard() {
  const [result, setResult] = useState<InternetDiagnosticsResult | null>(null);
  const [history, setHistory] = useState<InternetDiagnosticsResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [sessionDurationSeconds, setSessionDurationSeconds] = useState(60);
  const [sampleIntervalSeconds, setSampleIntervalSeconds] = useState(10);
  const [sessionEndsAt, setSessionEndsAt] = useState<number | null>(null);
  const [nextSampleAt, setNextSampleAt] = useState<number | null>(null);
  const [clock, setClock] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const runningRef = useRef(false);
  const sessionActiveRef = useRef(false);
  const sessionEndRef = useRef(0);
  const sampleIntervalRef = useRef(10);
  const sampleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runCheck = useCallback(async () => {
    if (runningRef.current) {
      return null;
    }

    runningRef.current = true;
    setIsRunning(true);
    setError(null);

    try {
      const output = await runInternetDiagnostics();
      setResult(output);
      setHistory((current) => [...current.slice(-59), output]);
      return output;
    } catch (runError) {
      const message =
        runError instanceof Error
          ? runError.message
          : "Unable to complete diagnostics.";
      setError(message);
      return null;
    } finally {
      runningRef.current = false;
      setIsRunning(false);
    }
  }, []);

  const clearTimers = useCallback(() => {
    if (sampleTimerRef.current) {
      clearTimeout(sampleTimerRef.current);
      sampleTimerRef.current = null;
    }
    if (sessionTimerRef.current) {
      clearTimeout(sessionTimerRef.current);
      sessionTimerRef.current = null;
    }
  }, []);

  const stopSession = useCallback(
    (message?: string) => {
      sessionActiveRef.current = false;
      clearTimers();
      setIsSessionActive(false);
      setSessionEndsAt(null);
      setNextSampleAt(null);
      if (message) {
        setError(message);
      }
    },
    [clearTimers],
  );

  const scheduleSample = useCallback(
    (delayMs: number) => {
      sampleTimerRef.current = setTimeout(async () => {
        if (!sessionActiveRef.current) {
          return;
        }

        await runCheck();

        if (!sessionActiveRef.current) {
          return;
        }

        const nextAt = Date.now() + sampleIntervalRef.current * 1000;
        if (nextAt < sessionEndRef.current) {
          setNextSampleAt(nextAt);
          scheduleSample(sampleIntervalRef.current * 1000);
          return;
        }

        setNextSampleAt(null);
      }, delayMs);
    },
    [runCheck],
  );

  const startSession = useCallback(async () => {
    const sanitizedDuration = Math.min(Math.max(sessionDurationSeconds, 15), 3600);
    const sanitizedInterval = Math.min(Math.max(sampleIntervalSeconds, 2), 600);

    setSessionDurationSeconds(sanitizedDuration);
    setSampleIntervalSeconds(sanitizedInterval);
    setHistory([]);
    setResult(null);
    setError(null);

    const now = Date.now();
    const endAt = now + sanitizedDuration * 1000;
    sessionEndRef.current = endAt;
    sampleIntervalRef.current = sanitizedInterval;
    sessionActiveRef.current = true;
    setIsSessionActive(true);
    setSessionEndsAt(endAt);

    await runCheck();

    const nextAt = Date.now() + sanitizedInterval * 1000;
    if (nextAt < endAt) {
      setNextSampleAt(nextAt);
      scheduleSample(sanitizedInterval * 1000);
    }

    sessionTimerRef.current = setTimeout(() => {
      stopSession();
    }, sanitizedDuration * 1000);
  }, [
    runCheck,
    sampleIntervalSeconds,
    scheduleSample,
    sessionDurationSeconds,
    stopSession,
  ]);

  useEffect(() => {
    if (!isSessionActive) {
      return;
    }

    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isSessionActive]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const remainingSeconds = sessionEndsAt
    ? Math.max(0, Math.ceil((sessionEndsAt - clock) / 1000))
    : 0;
  const nextSampleSeconds = nextSampleAt
    ? Math.max(0, Math.ceil((nextSampleAt - clock) / 1000))
    : null;

  const stabilityPercent = result?.stabilityScore ?? 0;

  const explanations = useMemo<Explanation[]>(() => {
    if (!result) {
      return [];
    }

    return [
      {
        label: "Download speed",
        layman: "How fast things like videos or web pages come to your device.",
        technical:
          "Throughput measured in megabits per second while downloading test data.",
        value: `${result.downloadMbps} Mbps`,
      },
      {
        label: "Upload speed",
        layman: "How fast your device can send data like photos or video calls.",
        technical:
          "Throughput measured in megabits per second while uploading a binary payload.",
        value: `${result.uploadMbps} Mbps`,
      },
      {
        label: "Latency",
        layman: "How quickly your internet responds after you ask for something.",
        technical:
          "Average request round-trip time in milliseconds across ping samples.",
        value: `${result.latencyMs} ms`,
      },
      {
        label: "Jitter",
        layman:
          "How steady your response time is. Lower jitter means smoother calls and gaming.",
        technical:
          "Average absolute difference between consecutive latency samples in milliseconds.",
        value: `${result.jitterMs} ms`,
      },
      {
        label: "Packet loss",
        layman: "How much data gets lost on the way and must be resent.",
        technical:
          "Percentage of probe requests that failed during the sampling window.",
        value: `${result.packetLossPercent}%`,
      },
      {
        label: "Success rate",
        layman: "How often your requests finish successfully.",
        technical:
          "Completed diagnostics ping requests divided by total requests as a percentage.",
        value: `${result.requestSuccessRatePercent}%`,
      },
      {
        label: "Stability score",
        layman: "A quick health score of your internet reliability.",
        technical:
          "Derived score (0-100) penalizing high jitter and packet loss from measured samples.",
        value: `${result.stabilityScore}/100`,
      },
      {
        label: "Connection type",
        layman: "A browser estimate of how strong/fast your current connection feels.",
        technical:
          "Navigator Network Information effectiveType classification from the browser.",
        value: result.networkInfo.effectiveType ?? "N/A",
      },
      {
        label: "Browser downlink",
        layman: "Browser's own estimate of your available download capacity.",
        technical:
          "Network Information API downlink value in megabits per second.",
        value:
          result.networkInfo.downlinkMbps !== undefined
            ? `${result.networkInfo.downlinkMbps} Mbps`
            : "N/A",
      },
      {
        label: "Browser RTT",
        layman: "Browser's estimate of round trip response delay.",
        technical:
          "Network Information API rtt estimate in milliseconds from client environment.",
        value:
          result.networkInfo.rttMs !== undefined
            ? `${result.networkInfo.rttMs} ms`
            : "N/A",
      },
      {
        label: "Data saver",
        layman: "If enabled, apps may use less data to reduce usage.",
        technical:
          "Network Information API saveData preference exposed by the browser.",
        value:
          result.networkInfo.saveData === undefined
            ? "N/A"
            : result.networkInfo.saveData
              ? "Enabled"
              : "Disabled",
      },
      {
        label: "Public IP",
        layman: "The internet-facing address your network appears to use.",
        technical:
          "External IPv4/IPv6 address fetched from an outbound IP reflection endpoint.",
        value: result.publicIp ?? "N/A",
      },
    ];
  }, [result]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-8">
      <section className="rounded-2xl border border-black/10 bg-gradient-to-br from-sky-500/20 via-white/60 to-violet-500/20 p-6 shadow-sm dark:border-white/10 dark:from-sky-500/20 dark:via-zinc-950/70 dark:to-violet-500/20">
        <h1 className="text-3xl font-semibold tracking-tight">
          Internet Stability Command Center
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-zinc-700 dark:text-zinc-300">
          Run timed diagnostics sessions, monitor live network behavior, and review
          each metric with plain-language and technical explanations.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-300">Session length (seconds)</span>
            <input
              type="number"
              min={15}
              max={3600}
              value={sessionDurationSeconds}
              onChange={(event) =>
                setSessionDurationSeconds(Number(event.target.value) || 0)
              }
              className="h-10 w-full rounded-lg border border-black/10 bg-white px-3 dark:border-white/10 dark:bg-zinc-900"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-300">Sample every (seconds)</span>
            <input
              type="number"
              min={2}
              max={600}
              value={sampleIntervalSeconds}
              onChange={(event) =>
                setSampleIntervalSeconds(Number(event.target.value) || 0)
              }
              className="h-10 w-full rounded-lg border border-black/10 bg-white px-3 dark:border-white/10 dark:bg-zinc-900"
            />
          </label>
          <button
            type="button"
            onClick={startSession}
            disabled={isRunning || isSessionActive}
            className="h-10 rounded-lg bg-black px-4 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-300"
          >
            {isRunning && !isSessionActive
              ? "Preparing..."
              : isSessionActive
                ? "Session running"
                : "Start timed test"}
          </button>
          <button
            type="button"
            onClick={() => stopSession()}
            disabled={!isSessionActive}
            className="h-10 rounded-lg border border-black/20 px-4 text-sm font-medium transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/10"
          >
            Stop session
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-zinc-600 dark:text-zinc-300">
          <span>Status: {isSessionActive ? "Active" : "Idle"}</span>
          <span>Time left: {isSessionActive ? `${remainingSeconds}s` : "-"}</span>
          <span>
            Next sample in:{" "}
            {isSessionActive && nextSampleSeconds !== null ? `${nextSampleSeconds}s` : "-"}
          </span>
          <button
            type="button"
            onClick={runCheck}
            disabled={isRunning}
            className="font-medium text-sky-700 underline underline-offset-2 transition hover:text-sky-500 disabled:opacity-60 dark:text-sky-300"
          >
            {isRunning ? "Running..." : "Run single sample now"}
          </button>
        </div>
      </section>

      {error ? (
        <p className="rounded-md border border-red-400/40 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {result ? (
        <section className="space-y-6">
          <section className="rounded-xl border border-black/10 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-zinc-950/60">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Live Stability Snapshot</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Last sampled at {new Date(result.sampledAt).toLocaleTimeString()}.
              </p>
            </div>
            <div className="mt-4 h-3 rounded-full bg-zinc-200 dark:bg-zinc-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-sky-500 to-violet-500 transition-all duration-500"
                style={{ width: `${stabilityPercent}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              Stability score: <span className="font-semibold">{result.stabilityScore}/100</span>
            </p>
          </section>

          <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {metricCard("Public IP", result.publicIp)}
            {metricCard("Download speed", `${result.downloadMbps} Mbps`, "highlight")}
            {metricCard("Upload speed", `${result.uploadMbps} Mbps`, "highlight")}
            {metricCard("Latency", `${result.latencyMs} ms`)}
            {metricCard("Jitter", `${result.jitterMs} ms`)}
            {metricCard("Packet loss", `${result.packetLossPercent}%`)}
            {metricCard("Success rate", `${result.requestSuccessRatePercent}%`)}
            {metricCard("Stability score", `${result.stabilityScore}/100`, "highlight")}
            {metricCard("Connection type", result.networkInfo.effectiveType)}
            {metricCard(
              "Browser downlink",
              result.networkInfo.downlinkMbps !== undefined
                ? `${result.networkInfo.downlinkMbps} Mbps`
                : undefined,
            )}
            {metricCard(
              "Browser RTT",
              result.networkInfo.rttMs !== undefined
                ? `${result.networkInfo.rttMs} ms`
                : undefined,
            )}
            {metricCard(
              "Data saver enabled",
              result.networkInfo.saveData === undefined
                ? undefined
                : result.networkInfo.saveData
                  ? "Yes"
                  : "No",
            )}
          </dl>

          <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {lineChart(
              "Download speed",
              "Mbps",
              history.map((item) => item.downloadMbps),
              "stroke-emerald-500",
            )}
            {lineChart(
              "Upload speed",
              "Mbps",
              history.map((item) => item.uploadMbps),
              "stroke-sky-500",
            )}
            {lineChart(
              "Latency",
              "ms",
              history.map((item) => item.latencyMs),
              "stroke-amber-500",
            )}
            {lineChart(
              "Jitter",
              "ms",
              history.map((item) => item.jitterMs),
              "stroke-violet-500",
            )}
            {lineChart(
              "Packet loss",
              "%",
              history.map((item) => item.packetLossPercent),
              "stroke-rose-500",
            )}
            {lineChart(
              "Stability score",
              "pts",
              history.map((item) => item.stabilityScore),
              "stroke-cyan-500",
            )}
          </section>

          <section className="rounded-xl border border-black/10 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-zinc-950/60">
            <h2 className="text-lg font-semibold">Metric Meaning Guide</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              Plain-language and technical context for every parameter shown above.
            </p>
            <div className="mt-4 grid gap-3">
              {explanations.map((item) => (
                <article
                  key={item.label}
                  className="rounded-lg border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900/70"
                >
                  <h3 className="text-base font-semibold">{item.label}</h3>
                  <p className="mt-1 text-sm">
                    <span className="font-medium">Current:</span> {item.value}
                  </p>
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                    <span className="font-semibold">Layman:</span> {item.layman}
                  </p>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                    <span className="font-semibold">Technical:</span> {item.technical}
                  </p>
                </article>
              ))}
            </div>
          </section>
        </section>
      ) : (
        <section className="rounded-xl border border-black/10 bg-white/70 p-6 text-sm text-zinc-600 shadow-sm backdrop-blur dark:border-white/10 dark:bg-zinc-950/60 dark:text-zinc-300">
          Start a session or run a single sample to populate live charts and metric explanations.
        </section>
      )}
    </main>
  );
}
