"""
Kronos forecasting integration helpers.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from threading import Lock
from typing import Any

import numpy as np
import pandas as pd

_PREDICTOR_CACHE: dict[tuple[str, str, str | None, int], Any] = {}
_PREDICTOR_LOCK = Lock()


def _resolve_torch_device(requested: str | None) -> str | None:
    """
    Kronos device: JSON body `device` > env KRONOS_DEVICE / ML_DEVICE > auto.

    Returns a torch device string suitable for KronosPredictor (`cuda`, `cpu`, `cuda:0`, …).
    """
    try:
        import torch

        cuda_ok = bool(torch.cuda.is_available())
    except Exception:
        cuda_ok = False

    def pick(raw: str | None) -> str | None:
        if raw is None:
            return None
        s = str(raw).strip()
        if not s:
            return None
        low = s.lower()
        if low == "cpu":
            return "cpu"
        if low in ("cuda", "gpu"):
            return "cuda" if cuda_ok else "cpu"
        if low.startswith("cuda:"):
            return s if cuda_ok else "cpu"
        return s

    for candidate in (requested, os.getenv("KRONOS_DEVICE"), os.getenv("ML_DEVICE")):
        got = pick(candidate)
        if got is not None:
            return got

    return "cuda" if cuda_ok else "cpu"


def _ensure_kronos_path() -> Path:
    """Resolve and register a Kronos source path that contains `model/__init__.py`."""
    env_path = os.getenv("KRONOS_SOURCE_DIR")
    candidates: list[Path] = []
    if env_path:
        candidates.append(Path(env_path))
    candidates.append(Path("/opt/kronos"))
    # Repo dev layout: services/ml-api/app/kronos_service.py → parents[4]/Kronos. Docker layout is
    # /app/app/… (too shallow for parents[4]) — do not index eagerly or extend() blows up before /opt/kronos runs.
    _here = Path(__file__).resolve()
    if len(_here.parents) >= 5:
        candidates.append(_here.parents[4] / "Kronos")
    candidates.append(Path.cwd() / "Kronos")
    for base in candidates:
        model_init = base / "model" / "__init__.py"
        if model_init.exists():
            base_str = str(base)
            if base_str not in sys.path:
                sys.path.insert(0, base_str)
            return base
    raise FileNotFoundError(
        "Kronos source not found. Set KRONOS_SOURCE_DIR or mount Kronos to /opt/kronos."
    )


def _infer_step_seconds(times: list[int]) -> int:
    if len(times) < 2:
        return 3600
    diffs = np.diff(np.array(times, dtype=np.int64))
    positive = diffs[diffs > 0]
    if positive.size == 0:
        return 3600
    return max(1, int(np.median(positive)))


def _get_predictor(
    model_name: str,
    tokenizer_name: str,
    device: str | None,
    max_context: int,
):
    key = (model_name, tokenizer_name, device, max_context)
    with _PREDICTOR_LOCK:
        if key in _PREDICTOR_CACHE:
            return _PREDICTOR_CACHE[key]
        _ensure_kronos_path()
        from model import Kronos, KronosPredictor, KronosTokenizer

        tokenizer = KronosTokenizer.from_pretrained(tokenizer_name)
        model = Kronos.from_pretrained(model_name)
        predictor = KronosPredictor(
            model=model,
            tokenizer=tokenizer,
            device=device,
            max_context=max_context,
        )
        _PREDICTOR_CACHE[key] = predictor
        return predictor


def predict_candles_with_kronos(
    bars: list[dict[str, Any]],
    pred_len: int,
    model_name: str,
    tokenizer_name: str,
    max_context: int,
    temperature: float,
    top_p: float,
    sample_count: int,
    device: str | None,
) -> list[dict[str, float | int]]:
    if len(bars) < 32:
        raise ValueError("Kronos requires at least 32 bars of history.")

    device = _resolve_torch_device(device)

    frame = pd.DataFrame(bars).copy()
    required = ["time", "open", "high", "low", "close"]
    missing = [c for c in required if c not in frame.columns]
    if missing:
        raise ValueError(f"Missing required bar fields: {missing}")

    frame["volume"] = frame.get("volume", 0.0).fillna(0.0)
    frame["amount"] = frame["volume"] * frame["close"]
    frame = frame.sort_values("time").reset_index(drop=True)

    x_df = frame[["open", "high", "low", "close", "volume", "amount"]].astype(float)
    # Kronos calc_time_stamps() uses .dt — must be Series, not DatetimeIndex (list → to_datetime is Index).
    x_timestamp = pd.Series(
        pd.to_datetime(frame["time"].astype(np.int64), unit="s", utc=True).array,
        index=frame.index,
    )
    step_seconds = _infer_step_seconds(frame["time"].astype(np.int64).tolist())

    last_ts = x_timestamp.iloc[-1]
    y_timestamp = pd.Series(
        pd.to_datetime(
            [last_ts + pd.Timedelta(seconds=step_seconds * i) for i in range(1, pred_len + 1)],
            utc=True,
        ).array,
    )

    predictor = _get_predictor(
        model_name=model_name,
        tokenizer_name=tokenizer_name,
        device=device,
        max_context=max_context,
    )

    pred_df = predictor.predict(
        df=x_df,
        x_timestamp=x_timestamp,
        y_timestamp=y_timestamp,
        pred_len=pred_len,
        T=temperature,
        top_p=top_p,
        sample_count=sample_count,
        verbose=False,
    ).reset_index(drop=False)

    pred_df = pred_df.rename(columns={"index": "timestamp"})
    output = []
    for _, row in pred_df.iterrows():
        ts = int(pd.Timestamp(row["timestamp"]).tz_convert("UTC").timestamp())
        output.append(
            {
                "time": ts,
                "open": float(row["open"]),
                "high": float(row["high"]),
                "low": float(row["low"]),
                "close": float(row["close"]),
                "volume": float(row["volume"]),
                "amount": float(row["amount"]),
            }
        )
    return output
