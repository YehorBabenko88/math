"""Prevent the separately installable Math SDK from acquiring trading authority.

This is an executable package/source boundary, not approval of remaining
legacy research files. history_sizing.py and PnL-coupled history_statistics.py
remain migration blockers until the Terminan-owned replacements are qualified.
"""
from __future__ import annotations

import ast
import importlib
from pathlib import Path
import sys
import tomllib
import unittest


ROOT = Path(__file__).resolve().parents[1]
SDK_MODULES = ("market_compute_api", "market_math", "history_statistics")
DISALLOWED_IMPORT_ROOTS = frozenset({
    "bybit", "grid", "terminan", "strattester", "meta_analyse",
    "psycopg", "sqlite3", "websockets", "requests", "httpx",
    "socket", "subprocess", "paramiko",
})
DISALLOWED_TRADING_SYMBOLS = frozenset({
    "PaperEngine", "PaperFill", "Position", "StrategyRegistry",
    "simulate_trade", "apply_sizing", "ruin_stats", "backtest",
    "submit_order", "place_order", "execute_strategy",
})
DISALLOWED_ACCOUNTING_KEYS = frozenset({"pnl", "fees", "slippage", "fill_price", "position_size"})


class MathSdkOwnershipTests(unittest.TestCase):
    def test_distribution_contains_only_independent_math_modules(self):
        manifest = tomllib.loads((ROOT / "pyproject.toml").read_text(encoding="utf-8"))
        project = manifest["project"]
        self.assertEqual(project["name"], "unified-math-kernels")
        self.assertEqual(project["dependencies"], [])
        modules = manifest["tool"]["setuptools"]["py-modules"]
        self.assertEqual(set(modules), set(SDK_MODULES))
        self.assertEqual(len(modules), len(SDK_MODULES))
        # Historical trading-like sources MUST NOT be distributed as Math SDK.
        self.assertNotIn("history_sizing", modules)
        self.assertNotIn("history_scientific_worker", modules)

    def test_observation_bootstrap_is_pure_and_reproducible(self):
        sys.path.insert(0, str(ROOT / "python"))
        try:
            stats = importlib.import_module("history_statistics")
            self.assertFalse(hasattr(stats, "apply_sizing"))
            self.assertFalse(hasattr(stats, "ruin_stats"))
            self.assertFalse(hasattr(stats, "paired_expectancy_bootstrap"))
            self.assertFalse(hasattr(stats, "block_bootstrap_expectancy"))
            values = [("a", 1.0), ("b", 2.0), ("c", 3.0), ("d", 4.0)]
            shifted = [(key, value + 0.25) for key, value in values]
            p = stats.paired_observation_bootstrap(values, shifted, runs=40, seed=17)
            self.assertEqual(p, stats.paired_observation_bootstrap(values, shifted, runs=40, seed=17))
            self.assertEqual(p["paired"], 4)
            self.assertAlmostEqual(p["delta_mean"], 0.25)
            b = stats.block_observation_bootstrap((x for _, x in values), block_size=2, runs=40, seed=23)
            self.assertEqual(b, stats.block_observation_bootstrap((x for _, x in values), block_size=2, runs=40, seed=23))
            self.assertEqual(b["samples"], 4)
            with self.assertRaises(ValueError):
                stats.block_observation_bootstrap([1.0, float("nan")], block_size=1)
        finally:
            sys.path.pop(0)

    def test_exported_math_code_has_no_exchange_database_or_trade_engine(self):
        for module in SDK_MODULES:
            path = ROOT / "python" / (module + ".py")
            tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
            imports = set()
            symbols = set()
            accounting_keys = set()
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    imports.update(alias.name.split(".")[0] for alias in node.names)
                elif isinstance(node, ast.ImportFrom) and node.module:
                    imports.add(node.module.split(".")[0])
                elif isinstance(node, (ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)):
                    symbols.add(node.name)
                elif isinstance(node, ast.Constant) and isinstance(node.value, str):
                    if node.value in DISALLOWED_ACCOUNTING_KEYS:
                        accounting_keys.add(node.value)
            with self.subTest(module=module):
                self.assertFalse(imports & DISALLOWED_IMPORT_ROOTS,
                                 imports & DISALLOWED_IMPORT_ROOTS)
                self.assertFalse(symbols & DISALLOWED_TRADING_SYMBOLS,
                                 symbols & DISALLOWED_TRADING_SYMBOLS)
                self.assertFalse(accounting_keys, accounting_keys)

    def test_sdk_computation_never_grants_trading_or_execution(self):
        sys.path.insert(0, str(ROOT / "python"))
        try:
            api = importlib.import_module("market_compute_api")
            request = {
                "schema": "math.market.compute.v1",
                "execution_authority": False,
                "source": {
                    "snapshot_sha256": "a" * 64,
                    "as_of_ms": 1792200000000,
                    "units": {"price": "quote/base", "volume": "base"},
                },
                "operations": [{
                    "operation": "price_bucket",
                    "input": {"price": "100.125", "tick": "0.01"},
                }],
            }
            result = api.compute_batch(request)
            self.assertEqual(result["results"][0]["value"], "100.13")
            self.assertIs(result["execution_authority"], False)
            self.assertIs(result["trading_authorized"], False)
            self.assertEqual(result["provenance"], "CALLER_SUPPLIED_UNATTESTED")
            with self.assertRaises(ValueError):
                api.compute_batch({**request, "execution_authority": True})
        finally:
            sys.path.pop(0)


if __name__ == "__main__":
    unittest.main()
