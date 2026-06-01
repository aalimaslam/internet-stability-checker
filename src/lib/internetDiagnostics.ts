import { diagnosticsClient } from "@/lib/axiosClient";
import type {
  InternetDiagnosticsResult,
  NetworkInformationSnapshot,
} from "@/types/internet";

type NavigatorConnection = {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function toTwoDecimals(value: number): number {
  return Number(value.toFixed(2));
}

function getNetworkInformation(): NetworkInformationSnapshot {
  if (typeof navigator === "undefined") {
    return {};
  }

  const connection = (navigator as Navigator & {
    connection?: NavigatorConnection;
    mozConnection?: NavigatorConnection;
    webkitConnection?: NavigatorConnection;
  }).connection;

  if (!connection) {
    return {};
  }

  return {
    effectiveType: connection.effectiveType,
    downlinkMbps: connection.downlink,
    rttMs: connection.rtt,
    saveData: connection.saveData,
  };
}

async function measureLatencyAndPacketLoss(attempts = 12) {
  const latencies: number[] = [];
  let successCount = 0;

  for (let index = 0; index < attempts; index += 1) {
    const start = performance.now();

    try {
      await diagnosticsClient.get("/api/diagnostics/ping", {
        params: { sample: index, t: Date.now() },
      });
      successCount += 1;
      latencies.push(performance.now() - start);
    } catch {
      latencies.push(3000);
    }
  }

  const averageLatency =
    latencies.reduce((sum, value) => sum + value, 0) / latencies.length;

  const jitter =
    latencies.length < 2
      ? 0
      : latencies
          .slice(1)
          .reduce((sum, value, idx) => sum + Math.abs(value - latencies[idx]), 0) /
        (latencies.length - 1);

  const packetLossPercent = ((attempts - successCount) / attempts) * 100;

  return {
    latencyMs: averageLatency,
    jitterMs: jitter,
    packetLossPercent,
    requestSuccessRatePercent: (successCount / attempts) * 100,
  };
}

async function measureDownloadMbps(sizeKB = 1024): Promise<number> {
  const start = performance.now();
  const response = await diagnosticsClient.get("/api/diagnostics/download", {
    params: { sizeKB, t: Date.now() },
    responseType: "arraybuffer",
  });

  const elapsedSeconds = (performance.now() - start) / 1000;
  const bytes = response.data.byteLength as number;

  return (bytes * 8) / elapsedSeconds / 1_000_000;
}

async function measureUploadMbps(sizeKB = 256): Promise<number> {
  const payload = new Uint8Array(sizeKB * 1024);

  const start = performance.now();
  const response = await diagnosticsClient.post(
    "/api/diagnostics/upload",
    payload.buffer,
    {
      headers: { "Content-Type": "application/octet-stream" },
    },
  );

  const elapsedSeconds = (performance.now() - start) / 1000;
  const uploadedBytes = response.data?.bytesReceived ?? payload.byteLength;

  return (uploadedBytes * 8) / elapsedSeconds / 1_000_000;
}

async function getPublicIp(): Promise<string | undefined> {
  try {
    const response = await diagnosticsClient.get<{ ip?: string }>(
      "https://api.ipify.org",
      {
        params: { format: "json" },
      },
    );

    return response.data.ip;
  } catch {
    return undefined;
  }
}

function calculateStabilityScore(packetLossPercent: number, jitterMs: number) {
  return clamp(100 - packetLossPercent * 2 - jitterMs * 0.5, 0, 100);
}

export async function runInternetDiagnostics(): Promise<InternetDiagnosticsResult> {
  const networkInfo = getNetworkInformation();

  const [latencyMetrics, downloadMbps, uploadMbps, publicIp] = await Promise.all([
    measureLatencyAndPacketLoss(),
    measureDownloadMbps(),
    measureUploadMbps(),
    getPublicIp(),
  ]);

  const stabilityScore = calculateStabilityScore(
    latencyMetrics.packetLossPercent,
    latencyMetrics.jitterMs,
  );

  return {
    sampledAt: new Date().toISOString(),
    publicIp,
    latencyMs: toTwoDecimals(latencyMetrics.latencyMs),
    jitterMs: toTwoDecimals(latencyMetrics.jitterMs),
    packetLossPercent: toTwoDecimals(latencyMetrics.packetLossPercent),
    downloadMbps: toTwoDecimals(downloadMbps),
    uploadMbps: toTwoDecimals(uploadMbps),
    stabilityScore: toTwoDecimals(stabilityScore),
    requestSuccessRatePercent: toTwoDecimals(
      latencyMetrics.requestSuccessRatePercent,
    ),
    networkInfo,
  };
}
