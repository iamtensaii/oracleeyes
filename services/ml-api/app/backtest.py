"""
Simple signal backtest: follow model sign on next-bar return; optional fee in bps per trade.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from app.features import build_features_and_labels
from app.model_train import load_model
from app.schemas import OhlcBarIn


def run_backtest(
    bars: list[OhlcBarIn],
    base_path: Path,
    model_id: str,
    fee_bps: float,
) -> tuple[float, float, int, float, list[dict]]:
    meta_path = base_path / ".artifacts" / "models" / model_id / "metadata.json"
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    horizon = int(meta["horizon"])
    clf = load_model(base_path, model_id)

    X, _ = build_features_and_labels(bars, horizon=horizon)
    if len(X) < 2:
        return 0.0, 0.0, 0, 0.0, []

    pred = clf.predict(X.to_numpy())
    closes = np.array([b.close for b in bars], dtype=float)
    step_rets = np.diff(closes) / np.clip(closes[:-1], 1e-12, None)

    n = min(len(pred), len(step_rets))
    strat = np.sign(pred[:n]) * step_rets[:n]

    fee = fee_bps / 10000.0
    flips = np.zeros(len(strat), dtype=bool)
    if len(strat):
        flips = np.abs(np.diff(np.sign(pred[:n]), prepend=0)) > 0
        strat = strat - flips.astype(float) * fee

    equity = np.cumprod(1.0 + strat)
    total_return = float(equity[-1] - 1.0) if len(equity) else 0.0
    sharpe = float(np.sqrt(252) * strat.mean() / (strat.std() + 1e-12)) if len(strat) else 0.0
    n_trades = int(np.sum(flips))
    win_rate = float(np.mean(strat > 0)) if len(strat) else 0.0

    curve = [
        {"t": int(bars[min(i + 1, len(bars) - 1)].time), "eq": float(equity[i])}
        for i in range(len(equity))
    ]

    return total_return, sharpe, n_trades, win_rate, curve[-1000:]
