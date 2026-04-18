---
document_id: OE-DOC-008
title: Glossary and conventions
status: current
last_reviewed: "2026-04-18"
---

# Glossary and conventions

## Document IDs

- **`OE-DOC-NNN`** — OracleEyes documentation identifier. Listed in **docs/README.md**. Use in commit messages, tickets, and runbooks (“per OE-DOC-006…”).

## Product terms

| Term | Meaning |
|------|---------|
| **Workspace** | Right-hand (or bottom on small screens) panel: ML, agents, or OHLC table |
| **Session tab** | Saved snapshot of bars + metadata in browser storage |
| **Pipeline strip** | Footer row: Data / Train / Pred / BT / Swarm completion hints |
| **Forecast on chart** | Violet (or similar) candles appended for visualization; not a live quote |

## Code naming (selected)

| Name | Meaning |
|------|---------|
| `product-copy.ts` | User-visible strings only |
| `pipeline-status-bar.tsx` | Footer pipeline UI + `PipelineState` type |
| `chart-context-strip.tsx` | Bar stats + expandable copy under chart |
| `ml-api.ts` | Typed HTTP client for FastAPI |

## Where to edit what

| Change type | Location |
|-------------|----------|
| Disclaimer / hero copy | `apps/web/src/lib/product-copy.ts` |
| ML request/response types | `apps/web/src/lib/ml-api.ts` + FastAPI `schemas.py` |
| Dashboard layout | `apps/web/src/components/dashboard/trading-dashboard.tsx` |
| Assistant behavior | `apps/web/src/lib/agent-swarm-system.ts`, `apps/web/src/app/api/chat/route.ts` |

## Related documents

| ID | Topic |
|----|--------|
| OE-DOC-003 | Next.js folder map |
| OE-DOC-010 | Contributing |
