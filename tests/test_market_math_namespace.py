"""Canonical namespace; exact sealed500→894 inverse preserves archival arithmetic."""
import ast,hashlib,importlib,importlib.util
from pathlib import Path
import tomllib
import unittest

ROOT=Path(__file__).resolve().parents[1]
def _verified_archival_math_source(current):
 fixture=Path(__file__).parent/'fixtures/historical_ohlc_transition'
 helper=Path(__file__).parent/'math_source_transition_custody.py';raw=helper.read_bytes()
 if hashlib.sha256(raw).hexdigest()!='aa0d833fcd15bf4f4d9b6674011fa6f7efbc38aaefb083d2f5aa5b717d9b243f':raise ValueError('DEV_SOURCE_CUSTODY_HELPER_SEAL')
 namespace={};exec(compile(raw,str(helper),'exec'),namespace)
 return namespace['verified_archival_source'](current,(fixture/'market_math_500.py.txt').read_bytes(),(fixture/'transition.json').read_bytes())

class MarketMathNamespaceTests(unittest.TestCase):
 def test_retired_module_is_absent_not_forwarded(self):
  self.assertFalse((ROOT/'python/market_profile_math.py').exists())
  self.assertIsNone(importlib.util.find_spec('market_profile_math'))
  module=importlib.import_module('market_math')
  self.assertEqual(Path(module.__file__).name,'market_math.py')
 def test_arithmetic_module_has_only_exact_authorized_500_transition(self):
  module=importlib.import_module('market_math')
  archival=_verified_archival_math_source(Path(module.__file__).read_bytes())
  self.assertEqual(hashlib.sha256(archival[:39461]).hexdigest(),'d1236748dfaee6bafc64fab7bbec74bedfd0e597bb5b238e3505b2e942cb7b60')
 def test_no_appended_definition_shadows_the_frozen_arithmetic(self):
  import market_math
  tree=ast.parse(Path(market_math.__file__).read_text())
  names=[n.name for n in tree.body if isinstance(n,(ast.FunctionDef,ast.ClassDef,ast.AsyncFunctionDef))]
  self.assertEqual(len(names),len(set(names)))
 def test_packaging_and_api_reexports_use_one_canonical_module(self):
  import market_math as canonical
  import market_compute_api as api
  self.assertIs(api.paper_fill_metrics,canonical.paper_fill_metrics)
  self.assertIs(api.decimal_epoch_units,canonical.decimal_epoch_units)
  self.assertEqual(set(tomllib.loads((ROOT/'pyproject.toml').read_text())['tool']['setuptools']['py-modules']),{'market_math','market_compute_api','history_statistics','market_math_wall_tracker'})

if __name__=='__main__':unittest.main()
