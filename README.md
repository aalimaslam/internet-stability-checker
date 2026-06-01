# Internet Stability Checker (Next.js)

A Next.js app with an advanced folder structure for internet diagnostics.

## Features

- Download speed check
- Upload speed check
- Latency + jitter sampling
- Packet loss estimation
- Request success rate
- Stability score
- Timed diagnostics sessions (configurable duration and sample interval)
- Realtime metric charts (download, upload, latency, jitter, packet loss, stability)
- Layman + technical explanations for each network parameter
- Browser network information (effective type, RTT, downlink, save-data)
- Public IP lookup
- Vercel Analytics integration

## Tech

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Axios

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000, then use **Start timed test** for realtime charting
or **Run single sample now** for one immediate measurement.
