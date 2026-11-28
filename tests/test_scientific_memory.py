from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'python'))

from scientific_memory import build_record, decode_record, digest


ROWS = [[str(i * 60000), str(price), str(price), str(price), str(price), '1.0000', '1.00']
        for i, price in reversed(list(enumerate((10, 12, 10, 12, 10), start=1)))]


class ScientificMemoryTest(unittest.TestCase):
    def make(self, operator='at_most', rows=ROWS, pin=None):
        return build_record('BTCUSDT', rows, pin or digest(rows), operator, '-0.1')

    def test_persistable_positive_and_negative_records_have_same_dataset(self):
        positive = self.make()
        negative = self.make('at_least')
        self.assertEqual(positive['status'], 'reproduced')
        self.assertEqual(negative['status'], 'contradicted')
        self.assertEqual(positive['dataset'], negative['dataset'])
        self.assertNotEqual(positive['id'], negative['id'])
        self.assertEqual(positive, self.make())
        self.assertEqual(positive['dataset']['end_ms'], 300000)
        self.assertEqual(positive['result']['exact_reference'][1], '-3/4')
        self.assertEqual(positive['result']['absolute_error'][1], '0')

    def test_dataset_rejects_changed_decimal_scale_gaps_and_duplicates(self):
        changed = [row.copy() for row in ROWS]
        changed[0][5] = '1.0'
        with self.assertRaises(ValueError):
            self.make(rows=changed, pin=digest(ROWS))
        for broken in [ROWS[:2] + ROWS[3:], [ROWS[0], *ROWS]]:
            with self.assertRaises(ValueError):
                self.make(rows=broken)

    def test_read_refuses_changed_record_with_original_id(self):
        record = self.make()
        tampered = {**record, 'status': 'contradicted'}
        self.assertEqual(decode_record(record['id'], record), record)
        with self.assertRaises(ValueError):
            decode_record(record['id'], tampered)
