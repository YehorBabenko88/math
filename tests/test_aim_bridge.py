import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "research"))
from aim_bridge import prepare, run_local

class ResearchBridgeTests(unittest.TestCase):
    def test_request_is_unverified(self):
        r = prepare("Prove x=x", "Definitions")
        self.assertEqual(r["schema"], "math.aim.research.v1")
        self.assertEqual(r["status"], "UNVERIFIED")
        self.assertEqual(len(r["digest"]), 64)

    def test_rejects_empty_and_oversized(self):
        for text in ("", " ", "a" * 100001):
            with self.assertRaises(ValueError):
                prepare(text)

    def test_rejects_bad_schema(self):
        with self.assertRaises(ValueError):
            run_local({"schema": "unknown"}, "/nonexistent")

    def test_tampered_request_rejected_before_execution(self):\n        request = prepare("x=x")\n        request["problem"] = "x=1"\n        with self.assertRaises(ValueError):\n            run_local(request, "/nonexistent")\n\n    def test_no_implicit_binary(self):
        with self.assertRaises(FileNotFoundError):
            run_local(prepare("x"), "/nonexistent")

if __name__ == "__main__":
    unittest.main()
