"""
Normalize OHLCV from raw CSV text.

Supports:
- MetaTrader 5 **headerless** export: YYYY.MM.DD HH:MM,open,high,low,close,volume,spread
- MT5 tab export with <DATE>, <TIME> and named columns
"""

from __future__ import annotations

import io
import re
from typing import Any

import pandas as pd

from app.schemas import OhlcBarIn

_MT5_COMPACT_DT = re.compile(
    r"^(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?"
)


def _strip_header(h: str) -> str:
    return re.sub(r"[<>]", "", h.strip()).upper()


def _parse_mt5_compact_dt(cell: str) -> int | None:
    m = _MT5_COMPACT_DT.match(str(cell).strip())
    if not m:
        return None
    y, mo, d, h, mi, sec = m.groups()
    sec = sec or "00"
    iso = f"{y}-{mo}-{d}T{h}:{mi}:{sec}Z"
    return int(pd.Timestamp(iso).timestamp())


def _parse_headerless_mt5(text: str, delim: str) -> list[OhlcBarIn] | None:
    first = ""
    for line in text.splitlines():
        t = line.strip()
        if t:
            first = t
            break
    if not first:
        return None
    first_cell = first.split(delim)[0].strip() if delim in first else ""
    if not _MT5_COMPACT_DT.match(first_cell):
        return None

    df = pd.read_csv(io.StringIO(text), delimiter=delim, header=None)
    rows: list[OhlcBarIn] = []
    for _, r in df.iterrows():
        if len(r) < 5:
            continue
        ts = _parse_mt5_compact_dt(r.iloc[0])
        if ts is None:
            continue
        try:
            o, h, low, c = float(r.iloc[1]), float(r.iloc[2]), float(r.iloc[3]), float(r.iloc[4])
        except (TypeError, ValueError):
            continue
        vol = None
        if len(r) > 5 and pd.notna(r.iloc[5]):
            try:
                vol = float(r.iloc[5])
            except (TypeError, ValueError):
                vol = None
        rows.append(
            OhlcBarIn(time=int(ts), open=o, high=h, low=low, close=c, volume=vol)
        )
    return rows if rows else None


def parse_ohlcv_csv(text: str) -> list[OhlcBarIn]:
    sample = text[:4096]
    delim = "\t" if sample.count("\t") > sample.count(",") else ","

    headerless = _parse_headerless_mt5(text, delim)
    if headerless is not None:
        headerless.sort(key=lambda x: x.time)
        seen: dict[int, OhlcBarIn] = {}
        for b in headerless:
            seen[b.time] = b
        return list(seen.values())

    df = pd.read_csv(io.StringIO(text), delimiter=delim)
    df.columns = [_strip_header(str(c)) for c in df.columns]

    rows: list[OhlcBarIn] = []
    for _, r in df.iterrows():
        rec = {c: r[c] for c in df.columns}
        ts = None
        if "TIMESTAMP" in rec and pd.notna(rec["TIMESTAMP"]):
            v = str(rec["TIMESTAMP"]).strip()
            if v.isdigit():
                n = int(v)
                ts = n // 1000 if n > 1_000_000_000_000 else n
        if ts is None and "DATE" in rec and "TIME" in rec and pd.notna(rec["DATE"]):
            d = str(rec["DATE"]).strip().replace(".", "-")
            t = str(rec["TIME"]).strip() if pd.notna(rec["TIME"]) else "00:00:00"
            if "." in str(rec["DATE"]):
                iso = f"{d}T{t}Z"
                ts = int(pd.Timestamp(iso).timestamp())
        if ts is None and "DATE" in rec and pd.notna(rec["DATE"]):
            ts = int(pd.Timestamp(str(rec["DATE"]).replace(".", "-")).timestamp())
        if ts is None:
            continue

        def num(*names: str) -> float | None:
            for n in names:
                if n in rec and pd.notna(rec[n]):
                    try:
                        return float(rec[n])
                    except (TypeError, ValueError):
                        continue
            return None

        o = num("OPEN", "O")
        h = num("HIGH", "H")
        low = num("LOW", "L")
        c = num("CLOSE", "C")
        vol = num("VOLUME", "VOL", "TICKVOL", "TICK_VOLUME")
        if None in (o, h, low, c):
            continue
        rows.append(
            OhlcBarIn(
                time=int(ts),
                open=float(o),
                high=float(h),
                low=float(low),
                close=float(c),
                volume=float(vol) if vol is not None else None,
            )
        )

    rows.sort(key=lambda x: x.time)
    seen: dict[int, OhlcBarIn] = {}
    for b in rows:
        seen[b.time] = b
    return list(seen.values())
