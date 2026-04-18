---
document_id: OE-DOC-005
title: API reference summary
status: current
last_reviewed: "2026-04-18"
---

# API reference summary

Authoritative implementations live in source; this document is a **stable index** for operators and integrators.

## Next.js Route Handlers (`apps/web`)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/chat` | Streaming UI messages; tools; optional Postgres memory |
| GET | `/api/setup-status` | Lightweight configuration / health hints |
| — | `/api/market/symbols`, `/api/market/ohlc` | Optional market helpers (env-gated) |
| POST | `/api/research/tradingagents-memo` | Optional TradingAgents subprocess bridge |

## ML API (`services/ml-api`)

Entrypoint: **`app/main.py`**. Schemas: **`app/schemas.py`**.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness; may report CUDA availability |
| POST | `/ingest/csv` | Multipart CSV → bars |
| POST | `/ingest/json` | JSON bars payload |
| POST | `/train` | Train model |
| POST | `/predict` | Predict with `model_id` |
| POST | `/backtest` | Backtest with fees |
| POST | `/predict/kronos` | Kronos generative path |
| POST | `/forecast/oracle` | Oracle deep forecast path |

## Related documents

| ID | Topic |
|----|--------|
| OE-DOC-002 | System context |
| OE-DOC-006 | Env vars that gate APIs |
