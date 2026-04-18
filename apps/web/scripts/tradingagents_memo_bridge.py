#!/usr/bin/env python3
"""
OracleEyes → TradingAgents thin bridge.

Run one TradingAgentsGraph.propagate(symbol, date) and print JSON to stdout.
Requires TRADINGAGENTS_REPO pointing at a clone of github.com/TauricResearch/TradingAgents
with that project's .env / keys configured.

Usage: tradingagents_memo_bridge.py SYMBOL YYYY-MM-DD
"""
from __future__ import annotations

import json
import os
import sys


def main() -> int:
    if len(sys.argv) != 3:
        print(json.dumps({"ok": False, "error": "usage: tradingagents_memo_bridge.py SYMBOL YYYY-MM-DD"}))
        return 1

    symbol, date_s = sys.argv[1], sys.argv[2]
    repo = os.environ.get("TRADINGAGENTS_REPO", "").strip()
    if not repo:
        print(json.dumps({"ok": False, "error": "TRADINGAGENTS_REPO is not set"}))
        return 1

    os.chdir(repo)
    if repo not in sys.path:
        sys.path.insert(0, repo)

    try:
        from tradingagents.default_config import DEFAULT_CONFIG
        from tradingagents.graph.trading_graph import TradingAgentsGraph
    except Exception as e:
        print(json.dumps({"ok": False, "error": f"import_failed: {e!s}"}))
        return 2

    cfg = DEFAULT_CONFIG.copy()
    cfg["max_debate_rounds"] = int(os.environ.get("TA_BRIDGE_MAX_DEBATE", "1"))
    cfg["max_risk_discuss_rounds"] = int(os.environ.get("TA_BRIDGE_MAX_RISK", "1"))

    try:
        ta = TradingAgentsGraph(debug=False, config=cfg)
        final_state, decision = ta.propagate(symbol, date_s)
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)[:4000]}))
        return 3

    keys = [
        "market_report",
        "sentiment_report",
        "news_report",
        "fundamentals_report",
        "investment_plan",
        "trader_investment_plan",
        "final_trade_decision",
    ]
    lines: list[str] = [f"# TradingAgents memo — {symbol} @ {date_s}\n"]
    for k in keys:
        v = final_state.get(k)
        if v is None:
            continue
        if isinstance(v, (dict, list)):
            chunk = json.dumps(v, default=str)[:8000]
            lines.append(f"## {k}\n```json\n{chunk}\n```\n")
        else:
            lines.append(f"## {k}\n{str(v)[:12000]}\n")

    lines.append(f"## process_signal\n{json.dumps(decision, default=str)[:8000]}\n")
    memo = "\n".join(lines)
    out = {
        "ok": True,
        "symbol": symbol,
        "date": date_s,
        "memo_markdown": memo,
        "decision": decision,
    }
    print(json.dumps(out, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
