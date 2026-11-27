"""H/R35: original Terminan D adapter -> Math-owned WallTracker, inert only.

Run from a full, exact Math source/wheel candidate. The independent test-only
Terminan D adapter must come from the exact immutable Git object; no fallback.
This is *not* approval to switch the running Terminan/Meta consumer or retire
legacy. No exchange, SQL, user paths or trading authority.
"""
from __future__ import annotations

from dataclasses import asdict
from decimal import Decimal
from hashlib import sha1
from pathlib import Path
from types import ModuleType, SimpleNamespace
import os
import subprocess
import sys
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
PYTHON = ROOT / "python"
if PYTHON.is_dir() and str(PYTHON) not in sys.path:
    sys.path.insert(0, str(PYTHON))

import market_math_wall_tracker as owner

D_HEAD = "8e5196840848d0991706cbbd4d782c58e3e7f719"
D_BLOB = "74025a11afefca5657b3b01755b4a710fe681f69"
D_PATH = "terminan/analytics/wall_tracker_math_adapter.py"
MATH_WALL_BLOB = "0e22810943294a8cf8163660b08b44a4cc54f9ed"


def _git_sha(data: bytes) -> str:
    return sha1(b"blob " + str(len(data)).encode("ascii") + b"\0" + data).hexdigest()


def _d_original_bytes():
    override = os.environ.get("H_TERMINAN_WALL_ADAPTER_FILE")
    if override:
        path = Path(override)
        if not path.is_absolute() or not path.is_file():
            raise AssertionError("H_D_ADAPTER_SOURCE_REQUIRED")
        data = path.read_bytes()
    else:
        checkout = ROOT / ".source" / "terminan-d136"
        sha = subprocess.check_output(
            ["git", "-C", str(checkout), "rev-parse", "HEAD"], text=True
        ).strip()
        if sha != D_HEAD:
            raise AssertionError("H_D_ADAPTER_HEAD_MISMATCH")
        data = subprocess.check_output(
            ["git", "-C", str(checkout), "show", "HEAD:" + D_PATH]
        )
    if _git_sha(data) != D_BLOB:
        raise AssertionError("H_D_ADAPTER_BLOB_MISMATCH")
    return data


def _original_d_adapter():
    mod = ModuleType("h_exact_original_terminan_d_wall_adapter")
    mod.__file__ = D_PATH
    with patch.dict(sys.modules, {mod.__name__: mod}):
        exec(compile(_d_original_bytes(), D_PATH, "exec"), mod.__dict__)
    return mod


def book(bids=(), asks=(), valid=True):
    return SimpleNamespace(valid=valid, bids=dict(bids), asks=dict(asks))


class OriginalDConsumerWall(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.d = _original_d_adapter()

    def test_original_math_module_is_actual_candidate_git_blob(self):
        self.assertEqual(_git_sha(Path(owner.__file__).read_bytes()),
                         MATH_WALL_BLOB)

    def test_d_factory_constructs_actual_math_class(self):
        obj = self.d.canonical_wall_tracker(
            min_notional="25000", max_age_ms=1500)
        self.assertIs(type(obj), owner.WallTracker)
        self.assertEqual(obj.min_notional, Decimal("25000"))
        self.assertEqual(obj.max_age_ms, 1500)

    def test_real_book_lifecycle_confidence_and_no_authority(self):
        obj = self.d.canonical_wall_tracker()
        self.assertEqual(obj.observe(book(
            bids=[(Decimal("100"), Decimal("1500"))]), 10000), [])
        warnings = obj.observe(book(), 12500)
        self.assertEqual(len(warnings), 1)
        self.assertEqual(asdict(warnings[0]), {
            "price": Decimal("100"), "side": "bid",
            "notional": Decimal("150000"), "lifetime_ms": 2500,
            "vanished_without_execution_evidence": True,
            "confidence": "unverified_cancellation_or_execution",
        })
        self.assertFalse(hasattr(warnings[0], "trading_authorized"))
        self.assertFalse(hasattr(obj, "execution_authority"))

    def test_invalid_book_resets_and_denies_spurious_warning(self):
        obj = self.d.canonical_wall_tracker()
        obj.observe(book(bids=[(Decimal("200"), Decimal("1000"))]), 1000)
        self.assertEqual(obj.observe(book(valid=False), 1001), [])
        self.assertEqual(obj.observe(book(), 1002), [])
        self.assertEqual(obj.active, {})

    def test_missing_math_import_fails_closed_without_local_fallback(self):
        with patch.object(self.d, "import_module", side_effect=ImportError):
            with self.assertRaisesRegex(
                    RuntimeError, "PINNED_MATH_WALL_TRACKER_REQUIRED"):
                self.d.canonical_wall_tracker()

    def test_incompatible_math_contract_fails_closed(self):
        with patch.object(self.d, "import_module", return_value=ModuleType("empty")):
            with self.assertRaisesRegex(
                    RuntimeError, "PINNED_MATH_WALL_TRACKER_CONTRACT_REQUIRED"):
                self.d.canonical_wall_tracker()


if __name__ == "__main__":
    unittest.main()
