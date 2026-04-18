---
document_id: OE-DOC-009
title: Security privacy and compliance stance
status: current
last_reviewed: "2026-04-18"
---

# Security, privacy, and compliance stance

## Product stance

OracleEyes is positioned as **research and learning software**. Outputs (charts, ML metrics, assistant text, forecasts) are **not** investment advice, trading signals, or guaranteed prices. Operators remain responsible for how they use or distribute results.

## Secrets and configuration

- Store secrets only in **ignored** env files (see **OE-DOC-006**).
- Do not embed API keys in client-visible bundles; server-only keys belong in server env, not `NEXT_PUBLIC_*`.

## Data handling

- **CSV** is processed in the user’s browser session for the default path; treat uploads as sensitive if they contain account identifiers.
- **Postgres** (`agent_memory`) stores assistant memory when enabled; scope retention and backups to your deployment policy.

## Third-party and optional integrations

- **Local LLM** — Traffic stays on the network paths you configure (`LOCAL_LLM_BASE_URL`); retention and logging are governed by that inference service and your deployment.
- **Optional market / web search** — When API keys are set, outbound calls follow those vendors’ policies; keep keys server-side only.

## Hardening for non-lab deployments

If you expose services beyond localhost:

- Restrict **CORS** on `ml-api`.
- Use TLS termination and auth in front of **web** and **ml-api**.
- Review tool exposure in **`/api/chat`** (ML and optional web search).

## Related documents

| ID | Topic |
|----|--------|
| OE-DOC-001 | Product overview |
| OE-DOC-007 | FAQ |
