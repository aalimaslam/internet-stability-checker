"use client";

import { useState } from "react";
import { runInternetDiagnostics } from "@/lib/internetDiagnostics";
import type { InternetDiagnosticsResult } from "@/types/internet";

function metricLabel(label: string, value: string | number | undefined) {
  return (
    <div className="rounded-lg border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-950">
      <dt className="text-sm text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="mt-1 text-lg font-semibold">{value ?? "N/A"}</dd>
    </div>
  );
}

export function InternetDiagnosticsDashboard() {
  const [result, setResult] = useState<InternetDiagnosticsResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runCheck = async () => {
    setIsRunning(true);
    setError(null);

    try {
      const output = await runInternetDiagnostics();
      setResult(output);
    } catch (runError) {
      const message =
        runError instanceof Error
          ? runError.message
          : "Unable to complete diagnostics.";
      setError(message);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">
          Internet Stability & Speed Checker
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Measure download speed, upload speed, latency, jitter, packet loss, and
          connection quality in one place.
        </p>
        <button
          type="button"
          onClick={runCheck}
          disabled={isRunning}
          className="inline-flex h-11 items-center justify-center rounded-full bg-black px-5 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-300"
        >
          {isRunning ? "Running diagnostics..." : "Run full diagnostics"}
        </button>
      </section>

      {error ? (
        <p className="rounded-md border border-red-400/40 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {result ? (
        <section className="space-y-4">
          <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {metricLabel("Public IP", result.publicIp)}
            {metricLabel("Download speed", `${result.downloadMbps} Mbps`)}
            {metricLabel("Upload speed", `${result.uploadMbps} Mbps`)}
            {metricLabel("Latency", `${result.latencyMs} ms`)}
            {metricLabel("Jitter", `${result.jitterMs} ms`)}
            {metricLabel("Packet loss", `${result.packetLossPercent}%`)}
            {metricLabel(
              "Success rate",
              `${result.requestSuccessRatePercent}%`,
            )}
            {metricLabel("Stability score", `${result.stabilityScore}/100`)}
            {metricLabel("Connection type", result.networkInfo.effectiveType)}
            {metricLabel(
              "Browser downlink",
              result.networkInfo.downlinkMbps
                ? `${result.networkInfo.downlinkMbps} Mbps`
                : undefined,
            )}
            {metricLabel(
              "Browser RTT",
              result.networkInfo.rttMs
                ? `${result.networkInfo.rttMs} ms`
                : undefined,
            )}
            {metricLabel(
              "Data saver enabled",
              result.networkInfo.saveData === undefined
                ? undefined
                : result.networkInfo.saveData
                  ? "Yes"
                  : "No",
            )}
          </dl>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Last sampled at {new Date(result.sampledAt).toLocaleString()}.
          </p>
        </section>
      ) : null}
    </main>
  );
}
