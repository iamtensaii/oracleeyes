from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class OhlcBarIn(BaseModel):
    time: int
    open: float
    high: float
    low: float
    close: float
    volume: Optional[float] = None


class IngestResponse(BaseModel):
    bars: list[OhlcBarIn]
    count: int


class TrainRequest(BaseModel):
    bars: list[OhlcBarIn]
    test_fraction: float = Field(0.2, ge=0.05, le=0.5)
    horizon: int = Field(1, ge=1, le=48)


class TrainResponse(BaseModel):
    model_id: str
    train_accuracy: float
    test_accuracy: float
    n_train: int
    n_test: int
    leakage_warning: str = ""
    baseline_majority_class: int = 0
    baseline_majority_test_accuracy: float = 0.0
    baseline_always_flat_test_accuracy: float = 0.0
    baseline_random_expected_accuracy: float = 0.0


class PredictRequest(BaseModel):
    model_id: str
    bars: list[OhlcBarIn]


class PredictResponse(BaseModel):
    direction: int  # -1, 0, 1
    proba: list[float]
    disclaimer: str


class BacktestRequest(BaseModel):
    bars: list[OhlcBarIn]
    model_id: str
    fee_bps: float = 0.0


class BacktestResponse(BaseModel):
    total_return: float
    sharpe_approx: float
    n_trades: int
    win_rate: float
    equity_curve: list[dict[str, Any]]


class KronosPredictRequest(BaseModel):
    bars: list[OhlcBarIn]
    pred_len: int = Field(24, ge=1, le=240)
    model_name: str = Field("NeoQuasar/Kronos-small")
    tokenizer_name: str = Field("NeoQuasar/Kronos-Tokenizer-base")
    max_context: int = Field(512, ge=64, le=4096)
    temperature: float = Field(1.0, ge=0.1, le=2.0)
    top_p: float = Field(0.9, ge=0.1, le=1.0)
    sample_count: int = Field(1, ge=1, le=8)
    device: Optional[str] = None


class KronosForecastBar(BaseModel):
    time: int
    open: float
    high: float
    low: float
    close: float
    volume: float
    amount: float


class KronosPredictResponse(BaseModel):
    model_name: str
    pred_len: int
    forecast: list[KronosForecastBar]
    disclaimer: str


class OracleForecastRequest(BaseModel):
    """Single curated deep forecast (Kronos ensemble); no RF training."""

    bars: list[OhlcBarIn]
    pred_len: int = Field(48, ge=1, le=240)
    device: Optional[str] = None


class OracleForecastResponse(BaseModel):
    engine: str
    model_name: str
    tokenizer_name: str
    max_context: int
    history_bars: int
    pred_len: int
    temperature: float
    top_p: float
    sample_count: int
    forecast: list[KronosForecastBar]
    notes: list[str]
    disclaimer: str
