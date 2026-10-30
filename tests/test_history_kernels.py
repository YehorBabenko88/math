import importlib.util
import math
import os
from pathlib import Path
import sys
import unittest

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'python'))
import history_timeseries as port
import history_nonlinear as analog
from history_worker import evaluate


def load(path):
    spec=importlib.util.spec_from_file_location('reference',path)
    m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m


class Parity(unittest.TestCase):
    def test_original_grid_semantics(self):
        grid=Path(os.environ.get('GRID_REFERENCE',ROOT.parent/'grid'))
        ref=load(grid/'grid/timeseries_research.py');nr=load(grid/'grid/nonlinear_research.py')
        for x in ([],[1.]*40,list(range(50)),[100+math.sin(i*.3) for i in range(100)]):
            for name,args in [('acf',(5,)),('difference',(2,)),('rolling_volatility',(7,)),('volatility_regime',(5,20)),('pair_error_correction',(x,40)),('distributed_lag_correlations',(x,4))]:
                self.assertEqual(getattr(port,name)(x,*args),getattr(ref,name)(x,*args))
            for name in ('local_analog_forecast','analog_direction_edge','walk_forward_analog'):
                kwargs={'min_train':20} if name=='walk_forward_analog' else {}
                self.assertEqual(getattr(analog,name)(x,**kwargs),getattr(nr,name)(x,**kwargs))

    def test_prefix_prediction_and_finite_control(self):
        q={'schema':'math.history.request.v1','prices':[100+i*.1 for i in range(40)],'dataset_fingerprint':'a'*64}
        a=evaluate(q)
        self.assertEqual(a,evaluate(q))
        self.assertTrue(math.isfinite(a['forecast']))
        self.assertFalse(a['execution_authority'])
        for prices in ([],[0.]*40,[float('nan')]*40,[True]*40):
            with self.assertRaises(ValueError):evaluate({**q,'prices':prices})
        with self.assertRaises(ValueError):evaluate({**q,'schema':'future'})

if __name__=='__main__':unittest.main()
