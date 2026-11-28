"""Non-authorizing scientific memory numeric regression; exact X10 numerical APIs.

Tests the existing Math-owned full numerical modules, not a second engine.
No exchange access, trading authority, databases or external services.
"""
from decimal import Decimal
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'python'))

from history_statistics import project_decimal_observations
from history_timeseries import acf
from scientific_memory import build_record, decode_record, digest, qualify_historical_record

ROWS = [[str(i * 60000), str(price), str(price), str(price), str(price), '1.0000', '1.00']
        for i, price in reversed(list(enumerate((10, 12, 10, 12, 10), start=1)))]


class P28ActualNumericScientificMemory(unittest.TestCase):
    def make(self, operator='at_most', rows=None, pin=None):
        if rows is None:
            rows = [row.copy() for row in ROWS]
        return build_record('BTCUSDT', rows, pin or digest(rows), operator, '-0.1')

    def test_real_acf_exact_fraction_and_binary64_projection(self):
        record = self.make()
        self.assertEqual(record['result']['exact_reference'][1], '-3/4')
        self.assertEqual(record['result']['absolute_error'][1], '0')
        self.assertEqual(record['result']['acf'], [1.0, -0.75, 0.5])
        self.assertEqual(acf((2.0, -2.0, 2.0, -2.0), max_lag=2), [1.0, -0.75, 0.5])
        self.assertEqual(project_decimal_observations([Decimal('2.00'), Decimal('-1.25')]), (2.0, -1.25))

    def test_same_dataset_two_descriptive_outcomes_never_authorize(self):
        reproduced, contradicted = self.make('at_most'), self.make('at_least')
        self.assertEqual((reproduced['status'], contradicted['status']), ('reproduced', 'contradicted'))
        self.assertEqual(reproduced['dataset'], contradicted['dataset'])
        self.assertNotEqual(reproduced['id'], contradicted['id'])
        for record in (reproduced, contradicted):
            qualification = qualify_historical_record(record)
            self.assertEqual(qualification['source_authenticity'], 'UNATTESTED')
            self.assertEqual(qualification['formal_proof'], 'NOT_ESTABLISHED')
            self.assertIs(qualification['execution_authority'], False)
            self.assertIs(qualification['trading_authorized'], False)
            self.assertEqual(decode_record(record['id'], record), record)

    def test_replay_determinism_and_canonical_identity(self):
        record = self.make()
        self.assertEqual(record, self.make())
        self.assertEqual(record['dataset']['end_ms'], 300000)
        self.assertEqual(record['dataset']['rows'], 5)
        self.assertEqual(record['dataset']['interval'], '1m')
        self.assertEqual(record['id'], digest({key: value for key, value in record.items() if key != 'id'}))
        tampered = {**record, 'status': 'contradicted'}
        with self.assertRaisesRegex(ValueError, 'fingerprint mismatch'):
            decode_record(record['id'], tampered)

    def test_pinned_bytes_and_minute_grid_refuse_mutations(self):
        changed = [row.copy() for row in ROWS]
        changed[0][5] = '1.0'
        with self.assertRaisesRegex(ValueError, 'Dataset bytes differ'):
            self.make(rows=changed, pin=digest(ROWS))
        for bad in (ROWS[:2] + ROWS[3:], [ROWS[0], *ROWS]):
            with self.subTest(rows=len(bad)):
                with self.assertRaisesRegex(ValueError, 'descending, contiguous'):
                    self.make(rows=bad)

    def test_constant_series_exact_acf_refuses_claim(self):
        rows = [row.copy() for row in ROWS]
        for row in rows:
            for index in (1, 2, 3, 4):
                row[index] = '10'
        with self.assertRaisesRegex(ValueError, 'Undefined normalized autocorrelation'):
            self.make(rows=rows)

    def test_nonzero_decimal_underflow_never_becomes_zero_observation(self):
        with self.assertRaisesRegex(ValueError, 'NONZERO_UNDERFLOW'):
            project_decimal_observations([Decimal('1e-100000')])


if __name__ == '__main__':
    unittest.main(verbosity=2)
