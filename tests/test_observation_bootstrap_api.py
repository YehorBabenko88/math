"""Pure observation bootstrap SDK contract, independent of trading and data providers."""
from __future__ import annotations

from copy import deepcopy
from hashlib import sha256
import importlib
import json
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "python"))
from market_compute_api import (
    OBSERVATION_BOOTSTRAP_REQUEST, OBSERVATION_BOOTSTRAP_RESULT,
    compute_observation_bootstrap,
)
from history_statistics import paired_observation_bootstrap, block_observation_bootstrap


def source():
    return {"snapshot_sha256": "a" * 64, "as_of_ms": 1792200000000,
            "unit": "dimensionless"}


def paired(base=None, variant=None, runs=32, seed=17):
    return {
        "schema": OBSERVATION_BOOTSTRAP_REQUEST,
        "execution_authority": False,
        "source": source(),
        "analysis": {
            "method": "paired", "runs": runs, "seed": seed,
            "base": base if base is not None else [
                {"id": "a", "value": 1.0}, {"id": "b", "value": 2.0},
                {"id": "c", "value": 3.0}],
            "variant": variant if variant is not None else [
                {"id": "a", "value": 1.25}, {"id": "b", "value": 2.25},
                {"id": "c", "value": 3.25}],
        },
    }


class ObservationBootstrapApiTests(unittest.TestCase):
    def test_paired_same_results_as_single_owner_and_no_authority(self):
        q = paired()
        before = deepcopy(q)
        got = compute_observation_bootstrap(q)
        expected = paired_observation_bootstrap(
            [(x["id"], x["value"]) for x in q["analysis"]["base"]],
            [(x["id"], x["value"]) for x in q["analysis"]["variant"]],
            runs=32, seed=17,
        )
        self.assertEqual(got["result"], expected)
        self.assertEqual(got["schema"], OBSERVATION_BOOTSTRAP_RESULT)
        self.assertEqual(got["algorithm_version"], "math.observation.bootstrap.v1")
        self.assertEqual(got["method"], "paired")
        self.assertEqual(got["provenance"], "CALLER_SUPPLIED_UNATTESTED")
        self.assertIs(got["execution_authority"], False)
        self.assertIs(got["trading_authorized"], False)
        canonical = json.dumps(q, sort_keys=True, separators=(",", ":"),
                               ensure_ascii=True, allow_nan=False).encode()
        self.assertEqual(got["request_sha256"], sha256(canonical).hexdigest())
        self.assertEqual(got, compute_observation_bootstrap(q))
        self.assertEqual(q, before)
        q["source"]["unit"] = "ratio"
        self.assertEqual(got["source"]["unit"], "dimensionless")

    def test_block_matches_single_numeric_owner_and_is_seeded(self):
        q = {"schema": OBSERVATION_BOOTSTRAP_REQUEST,
             "execution_authority": False, "source": source(),
             "analysis": {"method": "block",
                          "values": [1.0, -1.0, 2.0, 0.0, 3.0, -2.0],
                          "block_size": 2, "runs": 24, "seed": 23}}
        result = compute_observation_bootstrap(q)
        self.assertEqual(
            result["result"],
            block_observation_bootstrap(q["analysis"]["values"],
                                        block_size=2, runs=24, seed=23)
        )
        self.assertEqual(result, compute_observation_bootstrap(q))
        self.assertFalse(result["trading_authorized"])

    def test_refuses_pnl_trade_economics_and_malformed_values(self):
        q = paired()
        cases = [
            dict(q, execution_authority=True),
            dict(q, schema="math.observation.bootstrap.request.v2"),
            dict(q, extra="fee_rate"),
            dict(q, source=dict(q["source"], snapshot_sha256="unverified")),
            dict(q, source=dict(q["source"], as_of_ms=True)),
            dict(q, source=dict(q["source"], unit="pnl")),
            dict(q, analysis=dict(q["analysis"], execution="paper")),
            dict(q, analysis=dict(q["analysis"], runs=True)),
            dict(q, analysis=dict(q["analysis"], runs=1001)),
            dict(q, analysis=dict(q["analysis"], seed=-1)),
            dict(q, analysis=dict(q["analysis"], method="strategy")),
            dict(q, analysis=dict(q["analysis"], base=[{"id": "a", "value": 1.0,
                                                        "pnl": 0.9}])),
            dict(q, analysis=dict(q["analysis"], base=[{"id": "a", "value": "1.0"}])),
            dict(q, analysis=dict(q["analysis"], base=[{"id": "a", "value": True}])),
            dict(q, analysis=dict(q["analysis"], base=[{"id": "a", "value": float("nan")}])),
            dict(q, analysis=dict(q["analysis"], base=[{"id": "a", "value": float("inf")}])),
            dict(q, analysis=dict(q["analysis"], base=[{"id": "a", "value": 2.0},
                                                       {"id": "a", "value": 3.0}])),
        ]
        for index, bad in enumerate(cases):
            with self.subTest(case=index), self.assertRaises(ValueError):
                compute_observation_bootstrap(bad)

    def test_bounded_admission_and_nonfinite_arithmetic(self):
        q = paired(runs=1000)
        many = [{"id": str(i), "value": float(i)} for i in range(2000)]
        with self.assertRaisesRegex(ValueError, "BOOTSTRAP_WORK_LIMIT"):
            compute_observation_bootstrap(dict(q, analysis=dict(
                q["analysis"], base=many, variant=many)))
        with self.assertRaisesRegex(ValueError, "OBSERVATION_LIMIT"):
            compute_observation_bootstrap(dict(q, analysis=dict(
                q["analysis"], base=many + many + many, variant=[])))
        extreme = [{"id": "a", "value": -1e308},
                   {"id": "b", "value": -1e308}]
        high = [{"id": "a", "value": 1e308},
                {"id": "b", "value": 1e308}]
        with self.assertRaises(ValueError):
            compute_observation_bootstrap(paired(extreme, high, runs=4))

    def test_no_trade_imports_or_duplicate_resampling_engine(self):
        api = importlib.import_module("market_compute_api")
        stats = importlib.import_module("history_statistics")
        self.assertIs(api.paired_observation_bootstrap,
                      stats.paired_observation_bootstrap)
        self.assertIs(api.block_observation_bootstrap,
                      stats.block_observation_bootstrap)
        self.assertFalse(hasattr(api, "apply_sizing"))
        self.assertFalse(hasattr(api, "paired_expectancy_bootstrap"))


if __name__ == "__main__":
    unittest.main()
