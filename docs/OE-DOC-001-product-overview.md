---
document_id: OE-DOC-001
title: OracleEyes product overview
status: current
last_reviewed: "2026-04-18"
---

# OracleEyes product overview

## What OracleEyes is

**OracleEyes** is a **local-first trading research lab**: load historical OHLC (and optional volume) from CSV, visualize it on an interactive candlestick chart, run **classical ML** train / predict / backtest against a dedicated **FastAPI** service, optionally sketch **generative or ensemble-style forecasts** on the chart, and discuss results with a **streaming assistant** that can call tools (same ML endpoints, chart snapshot) when configured with an OpenAI-compatible LLM.

It is designed for **learning and experimentation**, not for live execution, brokerage integration, or regulated investment advice.

**Operators** normally run the whole product (**Postgres + ML API + web UI**) with **Docker Compose** from the repo root; see **OE-DOC-002** and the root **README.md** for exact commands.

## Who it is for

- Quant-curious developers and researchers who already have CSV exports (e.g. MT5 or other platforms).
- Teams that want a **reproducible** stack (Docker Compose: Postgres + ML API + Next.js) without mandatory cloud APIs.

## What it is not

- Not a broker, not order routing, not guaranteed PnL or signals.
- Not a substitute for compliance review if you adapt this for production-like use.

## Major product modules

| Module | User-facing surface | Backend |
|--------|---------------------|---------|
| Chart & sessions | Browser: tabs, chart, overlays | Client + static assets |
| ML & forecast | Workspace panel “ML & forecast” | `services/ml-api` |
| Agent swarm | Workspace panel + `/api/chat` | LLM host + optional Postgres memory |
| Data at rest | Optional | Postgres (`agent_memory` per `init.sql`) |

## Positioning line

All user-visible disclaimers are centralized where possible; see **OE-DOC-008** (glossary) and **`apps/web/src/lib/product-copy.ts`** for the canonical “research only” wording.

## Where to read next

- **OE-DOC-002** — How services connect.
- **OE-DOC-004** — How a typical session flows through the UI.
