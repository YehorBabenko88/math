"""Developer tests, not independent qualification."""
import unittest
from history_causal import Row, align, spectral_eligibility


class CausalTests(unittest.TestCase):
    def batch(self, rows, roster=('a',)):
        return align(tuple(rows), roster=roster, start_ms=0, end_ms=3, step_ms=1, as_of_ms=10)

    def test_future(self):
        a = Row('a','e',1,2,0,1.0)
        self.assertEqual(self.batch([a]), self.batch([a,Row('a','e',1,10,1,2.0)]))

    def test_gap(self):
        b = self.batch([Row('a','e',1,2,0,1.0),Row('a','e',3,4,0,3.0)])
        self.assertEqual(b['gaps'], (2,))
        self.assertEqual(len(b['segments']), 2)
        self.assertFalse(spectral_eligibility(b,min_samples=3)['structurally_eligible'])

    def test_revision(self):
        a = Row('a','e',1,2,0,1.0); b = Row('a','e',1,3,1,2.0)
        self.assertEqual(self.batch([b,a])['support'], ((1,(2.0,)),))

    def test_epoch(self):
        with self.assertRaisesRegex(ValueError,'EPOCH_CONFLICT'):
            self.batch([Row('a','e',1,2,0,1.0),Row('a','f',2,3,0,2.0)])

    def test_old_conflict(self):
        with self.assertRaisesRegex(ValueError,'REVISION_CONFLICT'):
            self.batch([Row('a','e',1,3,1,2.0),Row('a','e',1,2,0,1.0),Row('a','e',1,2,0,9.0)])

    def test_no_authority(self):
        self.assertFalse(self.batch([])['qualified'])

    def test_binary64(self):
        for x in (1, '1', float('nan'), float('inf'), True):
            with self.assertRaisesRegex(ValueError,'INVALID_SCHEMA'):
                self.batch([Row('a','e',1,2,0,x)])

    def test_spectral(self):
        b = self.batch([Row('a','e',i,i+1,0,float(i)) for i in (1,2,3)])
        self.assertTrue(spectral_eligibility(b,min_samples=3)['structurally_eligible'])
        self.assertFalse(spectral_eligibility(b,min_samples=3)['qualified'])

    def test_ordered_roster(self):
        b = self.batch([Row('a','e',1,2,0,1.0),Row('b','e',1,2,0,2.0)], ('b','a'))
        self.assertEqual(b['support'], ((1,(2.0,1.0)),))
        self.assertEqual(b['missing'], ((2,('b','a')),(3,('b','a'))))

    def test_constant(self):
        b = self.batch([Row('a','e',i,i+1,0,1.0) for i in (1,2,3)])
        self.assertIn('CONSTANT_SERIES',spectral_eligibility(b,min_samples=3)['reasons'])
