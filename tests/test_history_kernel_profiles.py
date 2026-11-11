"""SOURCE PROPOSAL ONLY: actual selected profile AST, no Node/scientific main.
Fixtures are exact raw Git source data, not project imports. No native admission.
"""
import ast,hashlib,pathlib,subprocess,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
SOURCE=ROOT/'scripts/history/parity.py'
SOURCE_SHA='8986b9d9bb24968730d7fa0c4f2d6e14d78062ca6233d575e4ece7caae1226b7'
ORIGINAL='3a9c542841e160f8b1924f155aaa2d1a676dfd04'
FINITE='b9c2f24b33285b7b0e06aebc354a9c61a909d204'
class SetupStageError(RuntimeError):pass
class KernelProfileContract(unittest.TestCase):
 def setUp(self):
  raw=SOURCE.read_bytes()
  if hashlib.sha256(raw).hexdigest()!=SOURCE_SHA:raise SetupStageError('PROPOSED_ACTUAL_SOURCE_PIN')
  tree=ast.parse(raw);names={'KERNELS','ORIGINAL_KERNEL_SHA256','FINITE_STATISTICS_SHA256'};constants={}
  for node in tree.body:
   if isinstance(node,ast.Assign) and len(node.targets)==1 and isinstance(node.targets[0],ast.Name) and node.targets[0].id in names:constants[node.targets[0].id]=ast.literal_eval(node.value)
  funcs=[node for node in tree.body if isinstance(node,ast.FunctionDef) and node.name=='validate_kernel_profile']
  if set(constants)!=names or len(funcs)!=1:raise SetupStageError('ACTUAL_PROFILE_AST_SELECTION')
  namespace={'hashlib':hashlib,**constants};exec(compile(ast.fix_missing_locations(ast.Module(body=funcs,type_ignores=[])),'<actual-proposed-profile-helper>','exec'),namespace);self.validate=namespace['validate_kernel_profile']
  def blob(ref,path):
   return subprocess.check_output(['git','--no-replace-objects','-C',str(ROOT),'show',ref+':'+path],timeout=10)
  paths=['python/'+n for n in constants['KERNELS']];self.original={p:blob(ORIGINAL,p) for p in paths};self.finite={p:blob(FINITE,p) for p in paths}
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
 def test_workflow_uses_explicit_profile_and_existing_branch_policy(self):
  finite=(ROOT/'.github/workflows/agent7-history-statistics.yml').read_text();history=(ROOT/'.github/workflows/history-integration.yml').read_text();script=SOURCE.read_text()
  for predicate in ("github.head_ref != 'fix/walk-forward-forecast-guard'","github.ref != 'refs/heads/fix/walk-forward-forecast-guard'"):self.assertIn(predicate,finite)
  self.assertIn('python scripts/history/parity.py --kernel-profile finite-bootstrap-v2',history);self.assertIn("default='original-v1'",script);self.assertIn("schema='math.history.scientific.profile-parity.v2'",script)
