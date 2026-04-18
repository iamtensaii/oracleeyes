# OracleEyes ML API

FastAPI service for CSV ingest, classical train/predict/backtest, and optional **Kronos** / **Oracle** forecast endpoints. Used by [`apps/web`](../apps/web) via `ML_API_URL` (Docker) or `NEXT_PUBLIC_ML_API_URL` (browser).

## Run with Docker (recommended)

From the **repo root** (`oracleeyes/` containing `docker-compose.yml`):

```bash
docker compose up -d ml-api postgres
```

Health check: `GET http://localhost:8000/health` (after publishing port `8000` in Compose).

## Run locally (development)

```bash
cd services/ml-api
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt
# For CUDA torch similar to Docker, see Dockerfile pip index-url lines.
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Set **`DATABASE_URL`** if you use features that touch Postgres (Compose wires `postgresql://oracleeyes:oracleeyes@localhost:5432/oracleeyes` when Postgres is published).

## GPU

`docker-compose.yml` may request `gpus: all`. If the engine errors on your machine, comment out the `gpus` block for CPU-only runs.

## CORS

`app/main.py` allows broad origins for local development. Tighten `allow_origins` before exposing the API on the public internet.

## HTTP surface (summary)

Authoritative list lives in **[app/main.py](app/main.py)**. Highlights:

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness + optional CUDA info |
| POST | `/ingest/csv` | Upload CSV → parsed bars |
| POST | `/ingest/json` | Bars JSON → same shape as ingest |
| POST | `/train` | Train RF-style model (min 80 bars) |
| POST | `/predict` | Class prediction + probabilities |
| POST | `/backtest` | Simulation on loaded model |
| POST | `/predict/kronos` | Generative candle forecast (Kronos) |
| POST | `/forecast/oracle` | Deep / ensemble-style forecast |

Request/response models are in **[app/schemas.py](app/schemas.py)**.

## Product documentation

Full stack and numbered guides (**OE-DOC-NNN**): **[../docs/README.md](../docs/README.md)**. API summary also in **OE-DOC-005**.
