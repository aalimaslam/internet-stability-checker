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

interface IpApiResponse {
  query?: string;
  isp?: string;
  city?: string;
  country?: string;
}

async function getIpData(): Promise<{ publicIp?: string, isp?: string, location?: string }> {
  try {
    // Note: ip-api.com is free for HTTP, but requires a pro plan for HTTPS.
    // For local development, we'll try to use a more reliable HTTPS source if possible.
    // Cloudflare's /cdn-cgi/trace or similar is often good for just IP.
    // For full GeoIP, we'll stick to this but be aware of mixed content in production.
    const response = await diagnosticsClient.get<IpApiResponse>(
      "http://ip-api.com/json/",
      {
        timeout: 5000,
      }
    );

    const { query: publicIp, isp, city, country } = response.data;
    const location = city && country ? `${city}, ${country}` : city || country;

    return { publicIp, isp, location };
  } catch {
    // Fallback if ip-api.com fails or is blocked
    try {
      const response = await diagnosticsClient.get<{ ip?: string }>(
        "https://api.ipify.org?format=json"
      );
      return { publicIp: response.data.ip };
    } catch {
      return {};
    }
  }
}

function calculateGrade(
  latency: number,
  jitter: number,
  packetLoss: number
): { grade: string; reason: string } {
  if (packetLoss > 5) return { grade: "F", reason: "Significant packet loss detected." };
  if (packetLoss > 2) return { grade: "D", reason: "Noticeable packet loss occurring." };

  if (latency > 200) return { grade: "D", reason: "Very high latency." };
  if (jitter > 50) return { grade: "D", reason: "Extremely unstable connection (high jitter)." };

  if (latency > 100) return { grade: "C", reason: "Moderate latency." };
  if (jitter > 30) return { grade: "C", reason: "Somewhat unstable connection." };

  if (latency > 50) return { grade: "B", reason: "Acceptable latency." };
  if (jitter > 15) return { grade: "B", reason: "Slight jitter detected." };

  if (latency > 20 || jitter > 5) return { grade: "A", reason: "Great connection quality." };

  return { grade: "A+", reason: "Excellent, rock-solid connection." };
}

function calculateStabilityScore(packetLossPercent: number, jitterMs: number) {
  return clamp(100 - packetLossPercent * 5 - jitterMs * 0.8, 0, 100);
}

export async function runInternetDiagnostics(): Promise<InternetDiagnosticsResult> {
  const networkInfo = getNetworkInformation();

  const [latencyMetrics, downloadMbps, uploadMbps, ipData] = await Promise.all([
    measureLatencyAndPacketLoss(),
    measureDownloadMbps(),
    measureUploadMbps(),
    getIpData(),
  ]);

  const stabilityScore = calculateStabilityScore(
    latencyMetrics.packetLossPercent,
    latencyMetrics.jitterMs,
  );

  const { grade, reason: gradeReason } = calculateGrade(
    latencyMetrics.latencyMs,
    latencyMetrics.jitterMs,
    latencyMetrics.packetLossPercent
  );

  return {
    sampledAt: new Date().toISOString(),
    publicIp: ipData.publicIp,
    isp: ipData.isp,
    location: ipData.location,
    grade,
    gradeReason,
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
