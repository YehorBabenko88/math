import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "research"))
from aim_bridge import prepare
from validate_request import validate

class ValidationTests(unittest.TestCase):
    def test_valid_request(self):
        self.assertEqual(validate(prepare("x=x"))["integrity"], "PASS")

    def test_modified_problem_rejected(self):
        r = prepare("x=x")
        r["problem"] = "x=0"
        with self.assertRaises(ValueError):
            validate(r)

    def test_unknown_field_rejected(self):
        r = prepare("x=x")
        r["unsafe"] = True
        with self.assertRaises(ValueError):
            validate(r)

    def test_false_proof_status_rejected(self):
        r = prepare("x=x")
        r["status"] = "PROVEN"
        with self.assertRaises(ValueError):
            validate(r)

if __name__ == "__main__":
    unittest.main()
