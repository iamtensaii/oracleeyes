# OracleEyes

Single project root for the trading-lab stack.

**Run the full stack (Postgres + ML API + Next.js web)** from this directory with **Docker Compose** — see [Docker (full stack)](#docker-full-stack) below. That is the supported way to get all services on one network with correct `ML_API_URL` / `DATABASE_URL` wiring.

| Path | Purpose |
|------|---------|
| `apps/web` | Next.js UI (CSV, charts, predict, agents) |
| `services/ml-api` | FastAPI (ingest, train, predict, backtest) |
| `docker-compose.yml` | Postgres + `ml-api` + `web` (Next.js) |
| `init.sql` | `agent_memory` table on first DB init |
| `apps/web/.env` | **Put your API keys here** (gitignored; create from `apps/web/.env.example`) |
| `apps/web/.env.example` | Template — run `cp apps/web/.env.example apps/web/.env` |
| `docs/README.md` | **Documentation portal** — catalog of all guides with **OE-DOC-NNN** IDs |
| `docs/ARCHITECTURE.md` | Short entry → links to **OE-DOC-002** / **OE-DOC-003** |
| `docs/CONTRIBUTING.md` | PR checklist (**OE-DOC-010**); extended notes in **OE-DOC-010** file |

## Architecture

See **[docs/README.md](docs/README.md)** for the full documentation set (product, system, Next.js flows, API, FAQ). Quick legacy path: **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

## Contributing

See **[docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)** before opening a PR. Handbook: **[docs/OE-DOC-010-contributing-and-quality-gates.md](docs/OE-DOC-010-contributing-and-quality-gates.md)**.

## Docker (full stack)

```bash
cd oracleeyes
cp .env.example .env
# Edit .env — set LOCAL_LLM_BASE_URL (and LOCAL_LLM_MODEL) for Assistant chat
docker compose build --no-cache   # optional clean rebuild
docker compose up -d
```

One-liner after the first setup:

```bash
docker compose up -d --build
```

- **Web UI:** [http://localhost:3000](http://localhost:3000)
- **ML API:** [http://localhost:8000](http://localhost:8000) (Predict page in the browser uses this URL)
- **Postgres:** not published to the host by default (only `web` / `ml-api` use `postgres:5432` on the Compose network; avoids exposing the DB on the machine’s interfaces). From the host: `docker compose exec postgres psql -U oracleeyes -d oracleeyes`. To bind `5432/tcp` on the Docker host (backups, GUI clients), add `ports` under `postgres` in `docker-compose.yml`.

`ML_API_URL` inside the `web` container points at `http://ml-api:8000` for server-side API routes; `NEXT_PUBLIC_ML_API_URL` is set at **image build** time to `http://localhost:8000` so the browser can reach the published ML port.

## Local Next.js

```bash
cd apps/web
cp .env.example .env
# Edit .env — set LOCAL_LLM_BASE_URL for your OpenAI-compatible LLM (host or sidecar)
npm install
npm run dev
```

`NEXT_PUBLIC_ML_API_URL` should stay `http://127.0.0.1:8000` while Docker Compose exposes the ML API on port 8000.
