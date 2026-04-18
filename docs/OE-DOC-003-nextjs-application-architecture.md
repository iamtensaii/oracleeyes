---
document_id: OE-DOC-003
title: Next.js application architecture
status: current
last_reviewed: "2026-04-18"
---

# Next.js application architecture

This document describes the **OracleEyes web app** (`apps/web`): App Router entrypoints, folder responsibilities, and how requests and state move through the system.

## Technology baseline

- **Next.js 16** (App Router), **React 19**, **TypeScript**.
- **Output:** `standalone` (see `apps/web/next.config.ts`) for Docker-friendly production images.

## High-level request flow

```mermaid
sequenceDiagram
  participant User
  participant Browser
  participant NextServer
  participant MLAPI
  participant PG as Postgres
  participant LLM as LLM_host

  User->>Browser: Open /
  Browser->>NextServer: GET page RSC_payload
  NextServer-->>Browser: Dashboard_shell

  User->>Browser: Upload_CSV_client_parse
  Note over Browser: parse_csv_chart_sessions_localStorage

  User->>Browser: Train_predict_client_or_server
  Browser->>MLAPI: POST train_predict_optional
  MLAPI-->>Browser: JSON

  User->>Browser: Chat_message
  Browser->>NextServer: POST api_chat_stream
  NextServer->>MLAPI: Tool_calls_optional
  NextServer->>PG: Memory_read_write_optional
  NextServer->>LLM: Stream_completion
  NextServer-->>Browser: SSE_UI_chunks
```

## App Router file tree (conceptual)

```text
apps/web/src/app/
├── layout.tsx              # Root layout, providers, viewport chrome
├── page.tsx                # Home: TradingDashboard (client)
├── globals.css             # Design tokens, oracle-tv chrome variables
├── error.tsx / global-error.tsx
└── api/
    ├── chat/route.ts       # Streaming assistant + tools + memory
    ├── setup-status/route.ts
    └── market/
        ├── symbols/route.ts
        └── ohlc/route.ts
```

**Redirects** (not separate `page.tsx` routes) are declared in **`next.config.ts`**:

| Source | Destination |
|--------|----------------|
| `/predict` | `/` |
| `/agents` | `/?tab=agents` |

## Component and library layout

```mermaid
flowchart TB
  subgraph app_layer [app]
    Page[page.tsx]
    Layout[layout.tsx]
  end
  subgraph dashboard [components_dashboard]
    TD[trading_dashboard]
    PP[predict_panel]
    AP[agent_panel]
    CCS[chart_context_strip]
    PSB[pipeline_status_bar]
    CST[chart_session_tabs]
  end
  subgraph chart [components_chart]
    CC[candlestick_chart]
  end
  subgraph lib_layer [lib]
    MLA[ml_api]
    PC[product_copy]
    AS[agent_swarm_system]
  end
  Page --> TD
  TD --> PP
  TD --> AP
  TD --> CCS
  TD --> PSB
  TD --> CST
  TD --> CC
  PP --> MLA
  AP --> MLA
```

| Path under `src/` | Responsibility |
|-------------------|------------------|
| `app/` | Routing, layouts, Route Handlers (`api/*/route.ts`) |
| `components/dashboard/` | Trading shell: tabs, chart column, workspace, ML & agents |
| `components/chart/` | Candlestick + overlays |
| `components/ui/` | Shared primitives (shadcn-style) |
| `lib/ml-api.ts` | Typed client for FastAPI |
| `lib/product-copy.ts` | User-visible strings |
| `lib/agent-swarm-system.ts` | Assistant system / depth behavior |
| `hooks/use-chart-sessions.ts` | Persisted chart tabs (localStorage) |
| `types/` | Shared TS types (`market`, `workspace-tab`) |

## Server vs client boundary

| Concern | Runs where |
|---------|------------|
| CSV parse for instant preview | Client (`"use client"` dashboard) |
| `POST /api/chat` | Server only |
| Calls to `ML_API_URL` from Route Handlers | Server |
| Calls to `NEXT_PUBLIC_ML_API_URL` from browser | Client (same-origin or CORS per ML API config) |

## Related documents

| ID | Topic |
|----|--------|
| OE-DOC-002 | Full stack including ML API and Postgres |
| OE-DOC-005 | API path summary |
| OE-DOC-008 | Naming and glossary |
