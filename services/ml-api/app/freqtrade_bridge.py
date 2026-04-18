"""
Freqtrade-shaped signal export and strategy stub.

OracleEyes exports JSON compatible with this schema; a future Freqtrade `IStrategy`
can read signals from file or Redis. This module documents the contract only.
"""

from __future__ import annotations

from typing import Literal, TypedDict


class OracleEyesSignal(TypedDict, total=False):
    timestamp: int
    side: Literal["long", "short", "flat"]
    size: float
    confidence: float
    symbol: str
    timeframe: str
    metadata: dict


# Example consumer sketch (not executed by ml-api):
#
# class OracleEyesImportStrategy(IStrategy):
#     def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
#         signal = load_json_signal("signals/latest.json")
#         ...
