---
document_id: OE-DOC-007
title: Frequently asked questions
status: current
last_reviewed: "2026-04-18"
---

# Frequently asked questions

## Product and scope

**Q: Is OracleEyes a trading platform?**  
**A:** No. It is a **research and learning** stack: charting, ML experiments, and an optional assistant. It does not place orders or connect to brokers.

**Q: Do you provide market data?**  
**A:** The core flow is **CSV upload** (and saved sessions). Optional market routes may exist but are not required for the main journey.

**Q: Are forecasts guaranteed prices?**  
**A:** No. Violet and other forecast visuals are **scenario / educational** outputs from models; see disclaimers in the UI and **OE-DOC-009**.

## Operations

**Q: How do I run Postgres + ML API + the web app together?**  
**A:** From the directory that contains **`docker-compose.yml`**, run `docker compose up -d --build` (after `cp .env.example .env` and any edits). That starts all three services on one Docker network. See **OE-DOC-002** and the root **README.md**.

**Q: Why does Postgres not listen on localhost?**  
**A:** Default Compose leaves Postgres **internal-only** to avoid Docker Desktop port-forward errors on some WSL setups. Use `docker compose exec postgres psql …` or re-enable `ports` in `docker-compose.yml` when your engine allows it.

**Q: Assistant returns configuration errors.**  
**A:** Set `LOCAL_LLM_BASE_URL` (and model id) in `apps/web/.env` to a reachable OpenAI-compatible endpoint. In Docker, `host.docker.internal` is often used for host LLMs.

**Q: Browser cannot reach ML API.**  
**A:** Ensure `NEXT_PUBLIC_ML_API_URL` matches where the browser runs (usually `http://localhost:8000` when ML is published on 8000). Server-side routes use `ML_API_URL`.

## Development

**Q: Where do I change user-visible wording?**  
**A:** Prefer `apps/web/src/lib/product-copy.ts` so chart, ML card, and chat stay aligned (**OE-DOC-008**).

**Q: What checks before a PR?**  
**A:** See **OE-DOC-010** and `docs/CONTRIBUTING.md`: `npx tsc --noEmit`, `npm run lint`, `npm run build` from `apps/web`.

## Related documents

| ID | Topic |
|----|--------|
| OE-DOC-001 | Product overview |
| OE-DOC-006 | Environment reference |
