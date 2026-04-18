# OracleEyes documentation

Official documentation for the **OracleEyes** trading research lab (CSV → chart → ML → assistant). All numbered guides use a stable **Document ID** (`OE-DOC-NNN`) for change control, support tickets, and internal references.

## Run the full stack with Docker Compose

The **default way** to run **postgres**, **ml-api**, and **web** together is from the repository root (the folder that contains `docker-compose.yml`):

```bash
cd oracleeyes   # or: cd path/to/oracleeyes/oracleeyes — same directory as docker-compose.yml
cp .env.example .env
# Edit .env — at minimum set LOCAL_LLM_BASE_URL (+ LOCAL_LLM_MODEL) if you use the assistant
docker compose up -d --build
```

Then open **http://localhost:3000** (web) and **http://localhost:8000/health** (ML API). Postgres listens on the **Compose network** only by default (not on host `localhost:5432` unless you uncomment `ports` in `docker-compose.yml`).

More detail: **[../README.md](../README.md)** (same commands + troubleshooting) and **OE-DOC-002** / **OE-DOC-006**.

## How to use this library

1. Start with **[OE-DOC-001-product-overview.md](./OE-DOC-001-product-overview.md)** if you are new to the product.
2. Use **[OE-DOC-002-system-architecture.md](./OE-DOC-002-system-architecture.md)** for stack and service boundaries.
3. Use **[OE-DOC-003-nextjs-application-architecture.md](./OE-DOC-003-nextjs-application-architecture.md)** for App Router layout, folders, and request flows.
4. Use **[OE-DOC-007-frequently-asked-questions.md](./OE-DOC-007-frequently-asked-questions.md)** for common operational questions.

Legacy short paths still work: [ARCHITECTURE.md](./ARCHITECTURE.md) (points into this set), [CONTRIBUTING.md](./CONTRIBUTING.md) (PR checklist).

## Document catalog

| Document ID | File | What it is about |
|-------------|------|------------------|
| **OE-DOC-001** | [OE-DOC-001-product-overview.md](./OE-DOC-001-product-overview.md) | Product intent, audience, scope, non-goals |
| **OE-DOC-002** | [OE-DOC-002-system-architecture.md](./OE-DOC-002-system-architecture.md) | End-to-end system: browser, web, ML API, Postgres, optional LLM / bridges |
| **OE-DOC-003** | [OE-DOC-003-nextjs-application-architecture.md](./OE-DOC-003-nextjs-application-architecture.md) | Next.js App Router structure, data flow, diagrams |
| **OE-DOC-004** | [OE-DOC-004-user-journeys-and-workspace.md](./OE-DOC-004-user-journeys-and-workspace.md) | Primary user journeys and dashboard workspace |
| **OE-DOC-005** | [OE-DOC-005-api-reference-summary.md](./OE-DOC-005-api-reference-summary.md) | Web and ML HTTP surfaces (summary tables) |
| **OE-DOC-006** | [OE-DOC-006-configuration-and-environment.md](./OE-DOC-006-configuration-and-environment.md) | Environment variables, Docker vs local dev |
| **OE-DOC-007** | [OE-DOC-007-frequently-asked-questions.md](./OE-DOC-007-frequently-asked-questions.md) | FAQ / Q&A for operators and developers |
| **OE-DOC-008** | [OE-DOC-008-glossary-and-conventions.md](./OE-DOC-008-glossary-and-conventions.md) | Terms, naming, where to change copy vs logic |
| **OE-DOC-009** | [OE-DOC-009-security-privacy-and-compliance.md](./OE-DOC-009-security-privacy-and-compliance.md) | Research-only stance, secrets, data handling |
| **OE-DOC-010** | [OE-DOC-010-contributing-and-quality-gates.md](./OE-DOC-010-contributing-and-quality-gates.md) | How to contribute; links to PR checklist |

**Document ID format:** `OE-DOC-NNN` (OracleEyes document sequence). Increment when adding a new top-level guide; do not reuse retired IDs.

## Related material outside this folder

| Location | Role |
|----------|------|
| [../README.md](../README.md) | Clone, Docker, local Next.js quick start |
| [../apps/web/README.md](../apps/web/README.md) | Web app entrypoints and scripts |
| [../services/ml-api/README.md](../services/ml-api/README.md) | ML API runbook |
