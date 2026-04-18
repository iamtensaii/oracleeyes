"""
Feature matrix from OHLCV bars for supervised direction label.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from app.schemas import OhlcBarIn


def bars_to_dataframe(bars: list[OhlcBarIn]) -> pd.DataFrame:
    df = pd.DataFrame(
        {
            "time": [b.time for b in bars],
            "open": [b.open for b in bars],
            "high": [b.high for b in bars],
            "low": [b.low for b in bars],
            "close": [b.close for b in bars],
            "volume": [b.volume if b.volume is not None else np.nan for b in bars],
        }
    )
    return df


def build_features_and_labels(
    bars: list[OhlcBarIn], horizon: int = 1
) -> tuple[pd.DataFrame, np.ndarray]:
    df = bars_to_dataframe(bars)
    df["ret_1"] = df["close"].pct_change()
    df["ret_5"] = df["close"].pct_change(5)
    df["hl_range"] = (df["high"] - df["low"]) / df["close"].replace(0, np.nan)
    df["co"] = (df["close"] - df["open"]) / df["open"].replace(0, np.nan)
    df["vol_roll"] = df["ret_1"].rolling(10).std()
    df["ma_ratio"] = df["close"] / df["close"].rolling(20).mean() - 1.0

    future_ret = df["close"].shift(-horizon) / df["close"] - 1.0
    y = np.sign(future_ret.to_numpy())
    y = np.where(np.isnan(y), 0, y).astype(np.int8)

    feat = df[["ret_1", "ret_5", "hl_range", "co", "vol_roll", "ma_ratio"]].copy()
    feat = feat.replace([np.inf, -np.inf], np.nan).fillna(0.0)

    mask = np.arange(len(df)) < len(df) - horizon
    feat = feat.loc[mask].reset_index(drop=True)
    y = y[: len(feat)]
    return feat, y
