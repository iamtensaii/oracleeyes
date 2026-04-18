# OracleEyes web (`apps/web`)

Next.js **App Router** app: CSV upload, candlestick chart, ML train/predict/backtest workspace, and streaming assistant (`/api/chat`).

## Quick start

```bash
cp .env.example .env
# Set LOCAL_LLM_BASE_URL (+ model id) for the assistant; NEXT_PUBLIC_ML_API_URL for browser → ML API
npm install
npm run dev
```

With the full stack in Docker from the **repo root** (`oracleeyes/`), use `docker compose` — see the root [README.md](../README.md).

## Layout

| Area | Location |
|------|----------|
| Main UI | `src/app/page.tsx` → `components/dashboard/trading-dashboard.tsx` |
| Chart stats strip | `components/dashboard/chart-context-strip.tsx` |
| Chart | `components/chart/candlestick-chart.tsx` |
| ML & forecast | `components/dashboard/predict-panel.tsx` |
| Agent swarm | `components/dashboard/agent-panel.tsx` + `src/app/api/chat/route.ts` |
| Shared strings | `src/lib/product-copy.ts` |
| ML HTTP client | `src/lib/ml-api.ts` |

Documentation portal (all **OE-DOC-*** guides): **[../docs/README.md](../docs/README.md)**. Architecture entry: **[../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)**. Contributing: **[../docs/CONTRIBUTING.md](../docs/CONTRIBUTING.md)**.

## Scripts

- `npm run dev` — local dev server  
- `npm run build` / `npm start` — production (also used in the `web` Dockerfile)  
- `npx tsx scripts/verify-xauusd-parse.ts` — optional CSV parse check  

## Agent notes

See [AGENTS.md](./AGENTS.md). Prefer **architecture doc** above before large refactors.
