"""SOURCE PROPOSAL ONLY: actual selected profile AST, no Node/scientific main.
Fixtures are exact raw Git source data, not project imports. No native admission.
"""
import ast,hashlib,pathlib,subprocess,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
SOURCE=ROOT/'scripts/history/parity.py'
SOURCE_SHA='b1cbee28685c5b38d7e379d257f29ff35fe7e9108daac3baf3057b50542fd3b1'
ORIGINAL='3a9c542841e160f8b1924f155aaa2d1a676dfd04'
FINITE='b9c2f24b33285b7b0e06aebc354a9c61a909d204'
UNIFIED='c12b2b4d177af5ed07ee3ea23854acf646cf06b2'
OBSERVATION='e3c56dd913bd5401b06b825dadc408e070edc691'
class SetupStageError(RuntimeError):pass
class KernelProfileContract(unittest.TestCase):
 def setUp(self):
  raw=SOURCE.read_bytes()
  committed=subprocess.check_output(['git','--no-replace-objects','-C',str(ROOT),'show','HEAD:scripts/history/parity.py'],timeout=10)
  # Accept only exact committed LF or whole-file checkout CRLF; no other filter transformation.
  if hashlib.sha256(committed).hexdigest()!=SOURCE_SHA or (raw!=committed and raw!=committed.replace(b'\n',b'\r\n')):raise SetupStageError('PROPOSED_ACTUAL_SOURCE_PIN')
  raw=committed
  tree=ast.parse(raw);names={'KERNELS','ORIGINAL_KERNEL_SHA256','FINITE_STATISTICS_SHA256','UNIFIED_STATISTICS_SHA256','SIZING_PATH','STATISTICS_PATH','RESEARCH_PROFILE','RESEARCH_STATISTICS_SHA256','PROFILES'};optional={'EXTENDED_RESEARCH_PROFILE','EXTENDED_STATISTICS_SHA256','RESEARCH_PROFILES','TRADE_RESEARCH_PROFILE','TRADE_STATISTICS_SHA256','PERMUTATION_RESEARCH_PROFILE','PERMUTATION_STATISTICS_SHA256'};constants={}
  for node in tree.body:
   if isinstance(node,ast.Assign) and len(node.targets)==1 and isinstance(node.targets[0],ast.Name) and node.targets[0].id in names|optional:
    name=node.targets[0].id
    if isinstance(node.value,ast.Tuple):
     constants[name]=tuple(constants[v.id] if isinstance(v,ast.Name) else ast.literal_eval(v) for v in node.value.elts)
    else:constants[name]=ast.literal_eval(node.value)
  funcs=[node for node in tree.body if isinstance(node,ast.FunctionDef) and node.name=='validate_kernel_profile']
  if not names<=set(constants) or len(funcs)!=1:raise SetupStageError('ACTUAL_PROFILE_AST_SELECTION')
  namespace={'hashlib':hashlib,**constants};exec(compile(ast.fix_missing_locations(ast.Module(body=funcs,type_ignores=[])),'<actual-proposed-profile-helper>','exec'),namespace);self.validate=namespace['validate_kernel_profile']
  def blob(ref,path):
   return subprocess.check_output(['git','--no-replace-objects','-C',str(ROOT),'show',ref+':'+path],timeout=10)
  paths=['python/'+n for n in constants['KERNELS']];self.original={p:blob(ORIGINAL,p) for p in paths};self.finite={p:blob(FINITE,p) for p in paths};self.unified={p:blob(UNIFIED,p) for p in paths}
  self.research={p:blob(OBSERVATION,p) for p in paths if p!=constants['SIZING_PATH']}
  self.extended={p:blob('420290fa9a3d918903673d86d714feb5d9492aca',p) for p in paths if p!=constants['SIZING_PATH']}
  self.rich={p:blob('00189c8551ac64e455f2e18150ebd89544981d55',p) for p in paths if p!=constants['SIZING_PATH']}
  self.permutation={p:blob('HEAD',p) for p in paths if p!=constants['SIZING_PATH']}
  fixtures=ROOT/'tests/fixtures/history-kernel-profiles'
  if (fixtures/'statistics-e3.py.txt').read_bytes()!=self.research['python/history_statistics.py'] or (fixtures/'statistics-420.py.txt').read_bytes()!=self.extended['python/history_statistics.py']:raise SetupStageError('IMMUTABLE_HISTORICAL_STATISTICS_FIXTURE')
  if (fixtures/'statistics-001.py.txt').read_bytes()!=self.rich['python/history_statistics.py']:raise SetupStageError('IMMUTABLE_V6_STATISTICS_FIXTURE')
  changed=[p for p in paths if self.original[p]!=self.finite[p]]
  if changed!=['python/history_statistics.py']:raise SetupStageError('EXACT_SINGLE_FINITE_FIXTURE_CALIBRATION')
 def test_original_profile_keeps_all_seven_byte_parity(self):
  result=self.validate('original-v1',self.original,self.original.copy())
  self.assertEqual(result['comparison_mode'],'ORIGINAL_RAW_BYTE_PARITY');self.assertEqual(result['changed_kernel_paths'],[]);self.assertEqual(len(result['preserved_original_kernel_sha256']),7)
 def test_original_profile_still_rejects_finite_source(self):
  with self.assertRaisesRegex(ValueError,'HISTORICAL_KERNEL_SOURCE_MISMATCH:python/history_statistics.py'):self.validate('original-v1',self.original,self.finite)
 def test_explicit_finite_profile_is_not_reported_as_original_parity(self):
  result=self.validate('finite-bootstrap-v2',self.original,self.finite)
  self.assertEqual(result['comparison_mode'],'PINNED_FINITE_PROFILE_NOT_ORIGINAL_BYTE_PARITY');self.assertEqual(result['changed_kernel_paths'],['python/history_statistics.py']);self.assertEqual(len(result['preserved_original_kernel_sha256']),6);self.assertEqual(len(result['current_kernel_sha256']),7);self.assertEqual(result['semantic_equivalence'],'NOT_CLAIMED_BY_SOURCE_PROFILE');self.assertEqual(result['numerical_qualification'],'SEPARATE_REQUIRED')
 def test_finite_profile_refuses_wrong_or_original_statistics(self):
  for data in (self.original['python/history_statistics.py'],self.finite['python/history_statistics.py']+b'\n'):
   with self.subTest(sha=hashlib.sha256(data).hexdigest()):
    current=self.finite.copy();current['python/history_statistics.py']=data
    with self.assertRaisesRegex(ValueError,'FINITE_KERNEL_PROFILE_PIN_MISMATCH'):self.validate('finite-bootstrap-v2',self.original,current)
 def test_six_other_kernels_cannot_drift_in_finite_profile(self):
  for path in self.finite:
   if path=='python/history_statistics.py':continue
   with self.subTest(path=path):
    current=self.finite.copy();current[path]+=b'\n'
    with self.assertRaisesRegex(ValueError,'HISTORICAL_KERNEL_SOURCE_MISMATCH'):self.validate('finite-bootstrap-v2',self.original,current)
 def test_reference_cannot_be_replaced_by_current_or_mutated_bytes(self):
  for path in self.original:
   with self.subTest(path=path):
    reference=self.original.copy();reference[path]+=b'\n'
    with self.assertRaisesRegex(ValueError,'HISTORY_REFERENCE_PIN_MISMATCH'):self.validate('finite-bootstrap-v2',reference,self.finite)
 def test_unknown_profile_missing_extra_and_nonbytes_refuse(self):
  with self.assertRaisesRegex(ValueError,'UNKNOWN_HISTORY_KERNEL_PROFILE'):self.validate('future',self.original,self.finite)
  for change in ('missing','extra','nonbytes'):
   with self.subTest(change=change):
    current=self.finite.copy()
    if change=='missing':current.pop(next(iter(current)))
    elif change=='extra':current['python/extra.py']=b''
    else:current[next(iter(current))]=bytearray(b'untrusted')
    with self.assertRaises(ValueError):self.validate('finite-bootstrap-v2',self.original,current)
 def test_original_inputs_unchanged_on_accept_and_refusal(self):
  old=self.original.copy();current=self.finite.copy();self.validate('finite-bootstrap-v2',self.original,self.finite)
  with self.assertRaises(ValueError):self.validate('original-v1',self.original,self.finite)
  self.assertEqual(self.original,old);self.assertEqual(self.finite,current)
 def test_explicit_unified_profile_preserves_six_kernels_and_records_no_automatic_equivalence(self):
  result=self.validate('unified-bootstrap-v3',self.original,self.unified)
  self.assertEqual(result['comparison_mode'],'PINNED_UNIFIED_PROFILE_NOT_ORIGINAL_BYTE_PARITY')
  self.assertEqual(result['changed_kernel_paths'],['python/history_statistics.py'])
  self.assertEqual(len(result['preserved_original_kernel_sha256']),6)
  self.assertEqual(result['semantic_equivalence'],'NOT_CLAIMED_BY_SOURCE_PROFILE')
  self.assertEqual(result['numerical_qualification'],'SEPARATE_REQUIRED')
 def test_unified_profile_refuses_original_finite_or_unpinned_statistics(self):
  for data in (self.original['python/history_statistics.py'],self.finite['python/history_statistics.py'],self.unified['python/history_statistics.py']+b'\\n'):
   with self.subTest(data_size=len(data)):
    current=self.unified.copy();current['python/history_statistics.py']=data
    with self.assertRaisesRegex(ValueError,'UNIFIED_KERNEL_PROFILE_PIN_MISMATCH'):self.validate('unified-bootstrap-v3',self.original,current)
 def test_workflow_uses_explicit_profile_and_existing_branch_policy(self):
  finite=(ROOT/'.github/workflows/agent7-history-statistics.yml').read_text();history=(ROOT/'.github/workflows/history-integration.yml').read_text();script=SOURCE.read_text()
  for predicate in ("github.head_ref != 'fix/walk-forward-forecast-guard'","github.ref != 'refs/heads/fix/walk-forward-forecast-guard'"):self.assertIn(predicate,finite)
  self.assertIn('python scripts/history/parity.py --kernel-profile research-statistics-v7',history);self.assertIn("default='original-v1'",script);self.assertIn("'math.history.scientific.profile-parity.v3'",script)
 def test_observation_profile_pins_numeric_kernel_and_requires_sizing_removal(self):
  result=self.validate('observation-bootstrap-v4',self.original,self.research)
  self.assertEqual(result['changed_kernel_paths'],['python/history_sizing.py','python/history_statistics.py'])
  self.assertEqual(len(result['preserved_original_kernel_sha256']),5)
  self.assertEqual(result['numerical_qualification'],'SEPARATE_REQUIRED')
  self.assertFalse((ROOT/'python/history_sizing.py').exists())
  for corrupt in ({**self.research,'python/history_sizing.py':self.original['python/history_sizing.py']},
                  {**self.research,'python/history_statistics.py':self.unified['python/history_statistics.py']}):
   with self.assertRaises(ValueError):self.validate('observation-bootstrap-v4',self.original,corrupt)

 def test_extended_profile_pins_actual_research_statistics_without_equivalence(self):
  result=self.validate('research-statistics-v5',self.original,self.extended)
  self.assertEqual(result['comparison_mode'],'PINNED_RESEARCH_STATISTICS_PROFILE_NOT_ORIGINAL_BYTE_PARITY')
  self.assertEqual(result['changed_kernel_paths'],['python/history_sizing.py','python/history_statistics.py'])
  self.assertEqual(len(result['preserved_original_kernel_sha256']),5)
  self.assertEqual(result['semantic_equivalence'],'NOT_CLAIMED_BY_SOURCE_PROFILE')
  self.assertEqual(result['numerical_qualification'],'SEPARATE_REQUIRED')
 def test_extended_profile_refuses_old_mutated_and_extra_sizing_sources(self):
  for payload in (self.research,{**self.extended,'python/history_statistics.py':self.extended['python/history_statistics.py']+b'\n'},{**self.extended,'python/history_sizing.py':self.original['python/history_sizing.py']}):
   with self.assertRaises(ValueError):self.validate('research-statistics-v5',self.original,payload)
  with self.assertRaises(ValueError):self.validate('observation-bootstrap-v4',self.original,self.extended)
 def test_profile_names_require_literal_strings_without_callbacks(self):
  class Foreign:
   def __eq__(self,other):raise AssertionError('foreign profile equality')
  class ForeignString(str):
   def __eq__(self,other):raise AssertionError('foreign string equality')
  for profile in (Foreign(),ForeignString('research-statistics-v5'),None,True):
   with self.assertRaises(ValueError):self.validate(profile,self.original,self.extended)

 def test_trade_profile_pins_new_source_without_redefining_old_profiles(self):
  result=self.validate('research-statistics-v6',self.original,self.rich)
  self.assertEqual(result['comparison_mode'],'PINNED_DECLARED_TRADE_PROFILE_NOT_ORIGINAL_BYTE_PARITY')
  self.assertEqual(result['changed_kernel_paths'],['python/history_sizing.py','python/history_statistics.py'])
  self.assertEqual(len(result['preserved_original_kernel_sha256']),5)
  self.assertEqual(result['semantic_equivalence'],'NOT_CLAIMED_BY_SOURCE_PROFILE')
  self.assertEqual(result['numerical_qualification'],'SEPARATE_REQUIRED')
 def test_trade_old_and_mutated_profiles_cannot_substitute(self):
  for profile in ('observation-bootstrap-v4','research-statistics-v5'):
   with self.assertRaises(ValueError):self.validate(profile,self.original,self.rich)
  for data in (self.research,self.extended,{**self.rich,'python/history_statistics.py':self.rich['python/history_statistics.py']+b'\n'},{**self.rich,'python/history_sizing.py':self.original['python/history_sizing.py']}):
   with self.assertRaises(ValueError):self.validate('research-statistics-v6',self.original,data)

 def test_permutation_v7_binds_actual_new_source_and_keeps_old_v6(self):
  result=self.validate('research-statistics-v7',self.original,self.permutation)
  self.assertEqual(result['comparison_mode'],'PINNED_PERMUTATION_DRAWDOWN_PROFILE_NOT_ORIGINAL_BYTE_PARITY')
  self.assertEqual(result['changed_kernel_paths'],['python/history_sizing.py','python/history_statistics.py'])
  self.assertEqual(result['semantic_equivalence'],'NOT_CLAIMED_BY_SOURCE_PROFILE')
  self.assertEqual(result['numerical_qualification'],'SEPARATE_REQUIRED')
  self.assertEqual(self.validate('research-statistics-v6',self.original,self.rich)['comparison_mode'],'PINNED_DECLARED_TRADE_PROFILE_NOT_ORIGINAL_BYTE_PARITY')
 def test_permutation_v7_refuses_all_old_mutated_and_sizing_sources(self):
  for data in (self.research,self.extended,self.rich,{**self.permutation,'python/history_statistics.py':self.permutation['python/history_statistics.py']+b'\n'},{**self.permutation,'python/history_sizing.py':self.original['python/history_sizing.py']}):
   with self.assertRaises(ValueError):self.validate('research-statistics-v7',self.original,data)
  for profile in ('observation-bootstrap-v4','research-statistics-v5','research-statistics-v6'):
   with self.assertRaises(ValueError):self.validate(profile,self.original,self.permutation)
 def test_permutation_workflow_explicit_v7(self):
  self.assertIn('python scripts/history/parity.py --kernel-profile research-statistics-v7',(ROOT/'.github/workflows/history-integration.yml').read_text(encoding='utf-8'))
