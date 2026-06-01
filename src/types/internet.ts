export interface NetworkInformationSnapshot {
  effectiveType?: string;
  downlinkMbps?: number;
  rttMs?: number;
  saveData?: boolean;
}

export interface InternetDiagnosticsResult {
  sampledAt: string;
  publicIp?: string;
  isp?: string;
  location?: string;
  grade: string;
  gradeReason: string;
  latencyMs: number;
  jitterMs: number;
  packetLossPercent: number;
  downloadMbps: number;
  uploadMbps: number;
  stabilityScore: number;
  requestSuccessRatePercent: number;
  networkInfo: NetworkInformationSnapshot;
}
