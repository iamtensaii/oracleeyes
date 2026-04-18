"""
OracleEyes ML API — FastAPI entrypoint.
"""

from __future__ import annotations

import json
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.backtest import run_backtest
from app.csv_normalize import parse_ohlcv_csv
from app.kronos_service import predict_candles_with_kronos
from app.model_train import artifact_dir, load_model, predict_latest, train_model
from app.oracle_forecast import run_oracle_deep_forecast
from app.schemas import (
    BacktestRequest,
    BacktestResponse,
    IngestResponse,
    KronosPredictRequest,
    KronosPredictResponse,
    OracleForecastRequest,
    OracleForecastResponse,
    OhlcBarIn,
    PredictRequest,
    PredictResponse,
    TrainRequest,
    TrainResponse,
)

BASE_PATH = Path(__file__).resolve().parent.parent


def _decode_csv_bytes(raw: bytes) -> str:
    """MT5 often exports UTF-16 LE with BOM; also accept UTF-8."""
    if raw.startswith(b"\xff\xfe"):
        s = raw.decode("utf-16-le")
    elif raw.startswith(b"\xfe\xff"):
        s = raw.decode("utf-16-be")
    else:
        s = None
        for enc in ("utf-8-sig", "utf-8", "utf-16-le", "latin-1"):
            try:
                s = raw.decode(enc)
                break
            except UnicodeDecodeError:
                continue
        if s is None:
            s = raw.decode("latin-1", errors="replace")
    return s.lstrip("\ufeff")


app = FastAPI(title="OracleEyes ML API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    out: dict[str, str | bool] = {"status": "ok"}
    try:
        import torch

        out["torch_cuda_available"] = bool(torch.cuda.is_available())
        if torch.cuda.is_available():
            out["torch_cuda_device"] = torch.cuda.get_device_name(0)
    except Exception as e:
        out["torch_error"] = str(e)[:200]
    return out


@app.post("/ingest/csv", response_model=IngestResponse)
async def ingest_csv(file: UploadFile = File(...)):
    raw = await file.read()
    text = _decode_csv_bytes(raw)
    bars = parse_ohlcv_csv(text)
    if not bars:
        raise HTTPException(400, "No valid OHLC bars parsed from CSV")
    return IngestResponse(bars=bars, count=len(bars))


@app.post("/ingest/json", response_model=IngestResponse)
def ingest_json(body: TrainRequest):
    return IngestResponse(bars=body.bars, count=len(body.bars))


@app.post("/train", response_model=TrainResponse)
def train(req: TrainRequest):
    if len(req.bars) < 80:
        raise HTTPException(400, "Need at least 80 bars to train")
    try:
        (
            model_id,
            acc_tr,
            acc_te,
            n_tr,
            n_te,
            maj_class,
            base_maj_te,
            base_flat_te,
            base_rand,
        ) = train_model(
            req.bars,
            BASE_PATH,
            test_fraction=req.test_fraction,
            horizon=req.horizon,
        )
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    warn = ""
    if acc_tr - acc_te > 0.15:
        warn = "Large train/test gap — possible overfitting; results are not investment advice."
    return TrainResponse(
        model_id=model_id,
        train_accuracy=acc_tr,
        test_accuracy=acc_te,
        n_train=n_tr,
        n_test=n_te,
        leakage_warning=warn,
        baseline_majority_class=maj_class,
        baseline_majority_test_accuracy=base_maj_te,
        baseline_always_flat_test_accuracy=base_flat_te,
        baseline_random_expected_accuracy=base_rand,
    )


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    meta_path = artifact_dir(BASE_PATH) / req.model_id / "metadata.json"
    if not meta_path.exists():
        raise HTTPException(404, "Unknown model_id")
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    horizon = int(meta["horizon"])
    clf = load_model(BASE_PATH, req.model_id)
    try:
        direction, proba = predict_latest(clf, req.bars, horizon)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    disc = (
        "Educational only: directional labels are noisy; "
        "past performance does not predict future results."
    )
    return PredictResponse(direction=direction, proba=proba, disclaimer=disc)


@app.post("/predict/kronos", response_model=KronosPredictResponse)
def predict_kronos(req: KronosPredictRequest):
    try:
        forecast = predict_candles_with_kronos(
            bars=[b.model_dump() for b in req.bars],
            pred_len=req.pred_len,
            model_name=req.model_name,
            tokenizer_name=req.tokenizer_name,
            max_context=req.max_context,
            temperature=req.temperature,
            top_p=req.top_p,
            sample_count=req.sample_count,
            device=req.device,
        )
    except FileNotFoundError as e:
        raise HTTPException(500, str(e)) from e
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    except Exception as e:
        raise HTTPException(500, f"Kronos prediction failed: {e}") from e

    return KronosPredictResponse(
        model_name=req.model_name,
        pred_len=req.pred_len,
        forecast=forecast,
        disclaimer=(
            "Educational forecasts only; model outputs are probabilistic and can be wrong. "
            "Do not use as direct investment advice."
        ),
    )


@app.post("/forecast/oracle", response_model=OracleForecastResponse)
def forecast_oracle(req: OracleForecastRequest):
    """
    One-button deep forecast: tuned Kronos ensemble + automatic model/context for long histories.
    """
    try:
        forecast, meta = run_oracle_deep_forecast(
            bars=[b.model_dump() for b in req.bars],
            pred_len=req.pred_len,
            device=req.device,
        )
    except FileNotFoundError as e:
        raise HTTPException(500, str(e)) from e
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    except Exception as e:
        raise HTTPException(500, f"Oracle forecast failed: {e}") from e

    return OracleForecastResponse(
        engine=meta["engine"],
        model_name=meta["model_name"],
        tokenizer_name=meta["tokenizer_name"],
        max_context=meta["max_context"],
        history_bars=meta["history_bars"],
        pred_len=meta["pred_len"],
        temperature=meta["temperature"],
        top_p=meta["top_p"],
        sample_count=meta["sample_count"],
        forecast=forecast,
        notes=meta["notes"],
        disclaimer=(
            "Oracle deep forecast is educational research output only; markets are non-stationary "
            "and this is not investment advice."
        ),
    )


@app.post("/backtest", response_model=BacktestResponse)
def backtest(req: BacktestRequest):
    try:
        total, sharpe, n_trades, win_rate, curve = run_backtest(
            req.bars, BASE_PATH, req.model_id, req.fee_bps
        )
    except FileNotFoundError as e:
        raise HTTPException(404, str(e)) from e
    return BacktestResponse(
        total_return=total,
        sharpe_approx=sharpe,
        n_trades=n_trades,
        win_rate=win_rate,
        equity_curve=curve[-1000:],
    )
