---
document_id: OE-DOC-006
title: Configuration and environment
status: current
last_reviewed: "2026-04-18"
---

# Configuration and environment

## Docker Compose first

For the **integrated stack** (Postgres + ML API + Next.js), configuration is applied when you run **`docker compose up`** from the repo root. See **`docker-compose.yml`** and root **`.env.example`**.

- **`web`** service: runtime env in the `environment:` block (e.g. `ML_API_URL`, `DATABASE_URL`, `LOCAL_LLM_BASE_URL`) plus build args for the image.
- **`ml-api`** service: `DATABASE_URL` and GPU-related settings.
- **`postgres`**: credentials and DB name match what `web` / `ml-api` expect on the internal network.

Full command reference: **[../README.md](../README.md)** and **OE-DOC-002** (Run the full stack).

## Files to know

| File | Scope |
|------|--------|
| Repository root `.env` | Compose-time variables (optional) |
| `apps/web/.env` | Next.js server + public build args |
| `apps/web/.env.example` | Documented template |

Never commit real secrets; root and app **`.gitignore`** exclude `.env` and variants.

## Web (`apps/web`)

| Variable | Role |
|----------|------|
| `NEXT_PUBLIC_ML_API_URL` | Browser → ML API (often `http://localhost:8000`) |
| `ML_API_URL` | Server Route Handlers → ML API (Docker: `http://ml-api:8000`) |
| `DATABASE_URL` | Postgres for chat memory (Compose network DSN) |
| `LOCAL_LLM_BASE_URL` / `LOCAL_LLM_MODEL` | OpenAI-compatible chat backend |
| Optional Google CSE | Web search tool in chat when keys present |
| `TRADINGAGENTS_REPO` | Enables `/api/research/tradingagents-memo` bridge |

## How Compose wires the web container

- **`web`** receives `ML_API_URL` and `DATABASE_URL` at **runtime** (see `docker-compose.yml` `environment:`).
- **`NEXT_PUBLIC_ML_API_URL`** is passed as a **build arg** when you `docker compose build web` so the client bundle points at the host-visible ML URL (e.g. `http://localhost:8000`).

## ML API (`services/ml-api`)

| Variable | Role |
|----------|------|
| `DATABASE_URL` | When features need Postgres from Python |

GPU-related behavior is described in **`services/ml-api/README.md`**.

## Related documents

| ID | Topic |
|----|--------|
| OE-DOC-009 | Security and secrets hygiene |
| OE-DOC-007 | FAQ |
