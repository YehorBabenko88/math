"""Canonical namespace; exact sealed500→894 inverse preserves archival arithmetic."""
import ast,hashlib,importlib,importlib.util
from pathlib import Path
import tomllib
import unittest

ROOT=Path(__file__).resolve().parents[1]
def _require_exact_historical_ohlc_transition(current,archive,ledger_raw):
 """Reverse only the sealed500→894 transition; a86 prefix is archival custody."""
 if any(type(raw) is not bytes for raw in (current,archive,ledger_raw)):raise ValueError('EXACT_RAW_TRANSITION_BYTES_REQUIRED')
 if hashlib.sha256(ledger_raw).hexdigest()!='7a1b1b4be854660354ff39857a7842f7cf1501f7ed773859e845f3285134d61e':raise ValueError('TRANSITION_LEDGER_SEAL')
 import json
 ledger=json.loads(ledger_raw)
 if set(ledger)!={'schema','base','implementation','archive','helper','delegate','authority','release'} or ledger['schema']!='math.historical-ohlc-directional-volume.source-transition.v1' or ledger['base']!='50048413605389a024dfef60e98f70126d788671' or ledger['implementation']!='89401328b21eb6a5ac75b2e6300ae12d05b0638c' or ledger['authority'] is not False or ledger['release']!='NO_GO':raise ValueError('TRANSITION_CLOSED_IDENTITY')
 old=ledger['archive'];helper=ledger['helper'];delegate=ledger['delegate']
 if len(archive)!=old['bytes'] or hashlib.sha256(archive).hexdigest()!=old['sha256'] or old['bytes']!=91150 or old['sha256']!='459ba0df58d89e8e69254f6b8ba8710103488aaee82a6c86fcb7b5502e003264':raise ValueError('ARCHIVAL500_FULL_BYTES')
 if old['archival_prefix_bytes']!=39461 or old['archival_prefix_sha256']!='d1236748dfaee6bafc64fab7bbec74bedfd0e597bb5b238e3505b2e942cb7b60' or hashlib.sha256(archive[:39461]).hexdigest()!=old['archival_prefix_sha256']:raise ValueError('ARCHIVAL_A86_PREFIX')
 block=helper['block'].encode('utf8');new=delegate['current'].encode('utf8');prior=delegate['archival'].encode('utf8')
 if helper['occurrences']!=1 or delegate['occurrences']!=1 or len(block)!=helper['bytes'] or hashlib.sha256(block).hexdigest()!=helper['sha256'] or current.count(block)!=1 or current.count(new)!=1:raise ValueError('EXACT_SINGLE_HELPER_AND_DELEGATE')
 reconstructed=current.replace(block,b'',1).replace(new,prior,1)
 if reconstructed!=archive:raise ValueError('ONLY_AUTHORIZED_FULL_SOURCE_TRANSITION')
 return True

class MarketMathNamespaceTests(unittest.TestCase):
 def test_retired_module_is_absent_not_forwarded(self):
  self.assertFalse((ROOT/'python/market_profile_math.py').exists())
  self.assertIsNone(importlib.util.find_spec('market_profile_math'))
  module=importlib.import_module('market_math')
  self.assertEqual(Path(module.__file__).name,'market_math.py')
 def test_arithmetic_module_has_only_exact_authorized_500_transition(self):
  module=importlib.import_module('market_math');fixture=Path(__file__).parent/'fixtures/historical_ohlc_transition'
  self.assertTrue(_require_exact_historical_ohlc_transition(Path(module.__file__).read_bytes(),(fixture/'market_math_500.py.txt').read_bytes(),(fixture/'transition.json').read_bytes()))
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
  self.assertEqual(set(tomllib.loads((ROOT/'pyproject.toml').read_text())['tool']['setuptools']['py-modules']),{'market_math','market_compute_api','history_statistics'})

if __name__=='__main__':unittest.main()
