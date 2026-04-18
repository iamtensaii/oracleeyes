"""
Oracle deep forecast — single curated Kronos path (ensemble sampling + stack pick).
"""

from __future__ import annotations

import os
from typing import Any

from app.kronos_service import predict_candles_with_kronos


def _choose_kronos_stack(history_len: int) -> tuple[str, str, int]:
    """
    Pick HF model / tokenizer / max_context from history length.

    Long histories: mini + 2k tokenizer (wider context window).
    Typical: small + base tokenizer (512).
    """
    threshold = int(os.getenv("ORACLE_LONG_HISTORY_BARS", "520"))
    if history_len >= threshold:
        return (
            "NeoQuasar/Kronos-mini",
            "NeoQuasar/Kronos-Tokenizer-2k",
            2048,
        )
    return (
        "NeoQuasar/Kronos-small",
        "NeoQuasar/Kronos-Tokenizer-base",
        512,
    )


def build_oracle_notes(
    *,
    history_len: int,
    pred_len: int,
    model_name: str,
    max_context: int,
) -> list[str]:
    """Human-readable limitations (also returned to the client)."""
    return [
        "Oracle deep forecast is one generative OHLC path from the Kronos foundation model — not a "
        "promise of where price will trade on the calendar.",
        "Works on any regular OHLC(+volume) series you load (FX, metals, indices, etc.) as long as "
        "timestamps are ordered; exotic gaps or sessions may not match model training.",
        f"History: {history_len} bars used as context; forward horizon: {pred_len} bars. "
        f"Model {model_name.split('/')[-1]} with max_context={max_context} (longer series are handled "
        "inside Kronos via windowing).",
        "Ensemble: multiple stochastic samples are averaged inside Kronos (sample_count>1) with "
        "conservative temperature — sharper than a single sample, still not calibrated uncertainty bands.",
        "Requirements: GPU recommended for speed; first run downloads weights from Hugging Face; "
        "Kronos repo must be mounted at KRONOS_SOURCE_DIR in Docker.",
        "Challenges: regime breaks, news shocks, and thin markets are not modeled; multi-step error "
        "compounds; do not size positions from this output alone.",
    ]


def run_oracle_deep_forecast(
    bars: list[dict[str, Any]],
    pred_len: int,
    device: str | None = None,
) -> tuple[list[dict[str, float | int]], dict[str, Any]]:
    """
    Run the single supported deep forecast recipe (tuned Kronos call).

    Returns (forecast_rows, meta) where meta is JSON-serializable for the API.
    """
    if len(bars) < 32:
        raise ValueError("Oracle deep forecast needs at least 32 OHLC bars.")

    model_name, tokenizer_name, max_context = _choose_kronos_stack(len(bars))

    temperature = float(os.getenv("ORACLE_KRONOS_TEMPERATURE", "0.72"))
    top_p = float(os.getenv("ORACLE_KRONOS_TOP_P", "0.9"))
    sample_count = int(os.getenv("ORACLE_KRONOS_SAMPLE_COUNT", "5"))
    sample_count = max(1, min(8, sample_count))

    forecast = predict_candles_with_kronos(
        bars=bars,
        pred_len=pred_len,
        model_name=model_name,
        tokenizer_name=tokenizer_name,
        max_context=max_context,
        temperature=temperature,
        top_p=top_p,
        sample_count=sample_count,
        device=device,
    )

    meta = {
        "engine": "oracle-deep-v1",
        "model_name": model_name,
        "tokenizer_name": tokenizer_name,
        "max_context": max_context,
        "history_bars": len(bars),
        "pred_len": pred_len,
        "temperature": temperature,
        "top_p": top_p,
        "sample_count": sample_count,
        "notes": build_oracle_notes(
            history_len=len(bars),
            pred_len=pred_len,
            model_name=model_name,
            max_context=max_context,
        ),
    }
    return forecast, meta
