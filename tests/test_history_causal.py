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


    def test_32_joint_support(self):
        roster = tuple(f'f{i:02}' for i in range(32))
        rows = tuple(Row(s,'e',t,t+1,0,float(t*(i+1)))
                     for t in range(1,257) for i,s in enumerate(roster))
        kw = dict(roster=roster,start_ms=0,end_ms=256,step_ms=1,as_of_ms=258)
        batch = align(rows,**kw)
        self.assertEqual(len(batch['support']),256)
        self.assertEqual(batch['support'][255],(256,tuple(float(256*(i+1)) for i in range(32))))
        self.assertEqual(len(batch['segments']),1)
        self.assertTrue(spectral_eligibility(batch,min_samples=256)['structurally_eligible'])
        self.assertFalse(batch['qualified'])
        self.assertEqual(batch,align(rows[::-1],**kw))
        self.assertEqual(batch,align(rows+(Row(roster[31],'e',1,258,1,999.0),),**kw))
        missing = align(tuple(r for r in rows if (r.series,r.end_ms)!=(roster[31],128)),**kw)
        self.assertEqual(missing['gaps'],(128,))
        self.assertEqual(missing['missing'],((128,(roster[31],)),))
        self.assertEqual(tuple(map(len,missing['segments'])),(127,128))
        self.assertFalse(spectral_eligibility(missing,min_samples=3)['structurally_eligible'])

    def test_roster33(self):
        with self.assertRaisesRegex(ValueError,'DIMENSION'):
            self.batch([],tuple(f'f{i}' for i in range(33)))

    def test_row_limit_preflight(self):
        with self.assertRaisesRegex(ValueError,'DIMENSION'):
            self.batch([None]*20001)

    def test_grid_limit_preflight(self):
        roster = tuple(f'f{i}' for i in range(32))
        with self.assertRaisesRegex(ValueError,'DIMENSION'):
            align((None,),roster=roster,start_ms=0,end_ms=7501,step_ms=1,as_of_ms=7503)
