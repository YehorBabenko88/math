"""H ROUND35 original-bytes Meta WallTracker -> Math owner behavioral differential.

Requires the OLD Meta WallTracker Git blob in a test-only local checkout or
a byte-identical source path, verified *before* executing the original.
This is a disposable synthetic book sequence: no Bybit, SQL, orders or users.
Passing only qualifies this observational sub-feature, not Meta retirement.
"""
import copy
from dataclasses import asdict
from decimal import Decimal
from hashlib import sha1
from pathlib import Path
import importlib
import os
import subprocess
import sys
from types import ModuleType, SimpleNamespace
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
PYTHON = ROOT / "python"
if str(PYTHON) not in sys.path:
    sys.path.insert(0, str(PYTHON))

from market_math import wall_notional
from market_math_wall_tracker import WallTracker as MathWallTracker

ORIGINAL_HEAD = "b1a4d6a41054f0040a88dc80b585380fb6b4f323"
ORIGINAL_PATH = "src/meta_analyse/wall_tracker.py"
ORIGINAL_BLOB = "faae6e3539c8b33e9d933fce4fd2a92b518c4ac5"


def original_wall_source():
    # An isolated source file is accepted only if its bytes equal Git's
    # original immutable object. A real checkout also requires exact HEAD.
    override = os.environ.get("H_META_WALL_ORIGINAL_FILE")
    if override:
        target = Path(override)
        if not target.is_absolute() or not target.is_file():
            raise AssertionError("H_META_SOURCE_FILE_REQUIRED")
        source = target.read_bytes()
    else:
        checkout = ROOT / ".source" / "meta-wall-original"
        commit = subprocess.check_output([
            "git", "-C", str(checkout), "rev-parse", "HEAD"],
            text=True).strip()
        if commit != ORIGINAL_HEAD:
            raise AssertionError("H_META_SOURCE_HEAD_MISMATCH")
        source = subprocess.check_output([
            "git", "-C", str(checkout), "show", "HEAD:" + ORIGINAL_PATH])
    oid = sha1(b"blob " + str(len(source)).encode("ascii") +
               b"\0" + source).hexdigest()
    if oid != ORIGINAL_BLOB:
        raise AssertionError("H_META_SOURCE_BLOB_MISMATCH")
    return source


def old_tracker_type():
    raw = original_wall_source()
    meta_math = ModuleType("market_profile_math")
    meta_math.wall_notional = wall_notional
    old = ModuleType("h_exact_original_meta_wall_tracker")
    old.__file__ = ORIGINAL_PATH
    with patch.dict(sys.modules, {
        "market_profile_math": meta_math,
        old.__name__: old,
    }):
        exec(compile(raw.decode("utf-8"), ORIGINAL_PATH, "exec"),
             old.__dict__)
    return old.WallTracker


def book(bids=(), asks=(), valid=True):
    return SimpleNamespace(valid=valid, bids=dict(bids), asks=dict(asks))


def compare_state(legacy, candidate):
    assert legacy.last_ts == candidate.last_ts
    assert legacy.active == candidate.active


class OriginalWallLifecycleDifferential(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.legacy_type = old_tracker_type()

    def pair(self, **kwargs):
        return self.legacy_type(**kwargs), MathWallTracker(**kwargs)

    def scenario(self, events, **kwargs):
        old, new = self.pair(**kwargs)
        for index, (at, frame) in enumerate(events):
            original_frame = copy.deepcopy(frame)
            before = old.observe(frame, at)
            after = new.observe(frame, at)
            with self.subTest(index=index, at=at):
                self.assertEqual([asdict(x) for x in before],
                                 [asdict(x) for x in after])
                self.assertEqual(old.active, new.active)
                self.assertEqual(old.last_ts, new.last_ts)
                self.assertEqual(frame, original_frame)
        return old, new

    def test_two_side_disappearance_and_original_confidence(self):
        d = Decimal
        self.scenario([
            (1000, book([(d("100"), d("1000"))],
                        [(d("101"), d("1000"))])),
            (3000, book()),
        ])
        legacy, candidate = self.pair()
        full = book([(d("100"), d("1000"))])
        legacy.observe(full, 1000)
        candidate.observe(full, 1000)
        actual = candidate.observe(book(), 2500)
        self.assertEqual(len(actual), 1)
        self.assertEqual(actual[0].lifetime_ms, 1500)
        self.assertEqual(actual[0].confidence,
                         "unverified_cancellation_or_execution")
        self.assertTrue(actual[0].vanished_without_execution_evidence)
        self.assertEqual([asdict(v) for v in actual],
                         [asdict(v) for v in legacy.observe(book(), 2500)])

    def test_exact_3000ms_boundary_then_expired_excluded(self):
        d = Decimal
        for duration in (2999, 3000, 3001):
            with self.subTest(duration=duration):
                old, new = self.pair()
                example = book([(d("100"), d("1000"))])
                old.observe(example, 1000)
                new.observe(example, 1000)
                a = old.observe(book(), 1000 + duration)
                b = new.observe(book(), 1000 + duration)
                self.assertEqual([asdict(x) for x in a],
                                 [asdict(x) for x in b])
                self.assertEqual(len(b), 1 if duration <= 3000 else 0)

    def test_invalid_and_backwards_clocks_reset_history(self):
        d = Decimal
        self.scenario([
            (1000, book([(d("100"), d("1000"))])),
            (1010, book(valid=False)),
            (1020, book()),
            (2000, book([(d("101"), d("1000"))])),
            (1900, book()),
            (2100, book()),
        ])

    def test_repeated_levels_preserve_first_seen_and_notional(self):
        d = Decimal
        self.scenario([
            (1000, book([(d("100.5"), d("1000"))])),
            (2000, book([(d("100.5"), d("1100"))])),
            (3000, book([(d("100.5"), d("1200"))])),
            (3500, book()),
        ], min_notional=d("100000"), max_age_ms=3000)

    def test_below_threshold_and_zero_wall_are_ignored(self):
        d = Decimal
        self.scenario([
            (1000, book([(d("100"), d("0")),
                         (d("99"), d("999"))])),
            (1010, book()),
            (1020, book([(d("100"), d("1000"))])),
        ])

    def test_wall_notional_and_returned_state_not_authority(self):
        d = Decimal
        self.assertEqual(wall_notional(d("100"), d("1000")), d("100000"))
        old, new = self.pair()
        self.assertEqual(old.observe(book(), 100), [])
        self.assertEqual(new.observe(book(), 100), [])
        for forbidden in ("trading_authorized", "execution_authority",
                          "delisting_authorized", "paper_admitted"):
            self.assertNotIn(forbidden, vars(new))
            self.assertNotIn(forbidden, vars(new.__class__))

    def test_malformed_price_math_denied_equally(self):
        d = Decimal
        frame = book([(d("NaN"), d("1"))])
        old, new = self.pair()
        with self.assertRaises(ValueError):
            old.observe(frame, 100)
        with self.assertRaises(ValueError):
            new.observe(frame, 100)


if __name__ == "__main__":
    unittest.main()
