import io,pathlib,sys,tarfile,tempfile,unittest,zipfile
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'scripts'))
import importlib.util,importlib
gate=importlib.import_module('math_sdk_source_bytes') if importlib.util.find_spec('math_sdk_source_bytes') else None
class RawMathSdkBytesTests(unittest.TestCase):
 def setUp(self):self.assertIsNotNone(gate,'missing raw SDK byte verifier')
 def raw(self):return {name:(('# '+name+'\nVALUE=1\n').encode() if name.endswith('.py') else b'[build-system]\n') for name in gate.SDK_FILES}
 def test_checkout_refuses_crlf_instead_of_normalizing_baseline(self):
  raw=self.raw();gate.require_checkout(raw,dict(raw))
  for name in raw:
   changed=dict(raw);changed[name]=changed[name].replace(b'\n',b'\r\n')
   with self.assertRaises(ValueError):gate.require_checkout(raw,changed)
 def test_materialization_preserves_all_four_raw_files(self):
  raw=self.raw()
  with tempfile.TemporaryDirectory() as tmp:
   gate.materialize(raw,pathlib.Path(tmp));self.assertEqual(raw,{name:(pathlib.Path(tmp)/name).read_bytes() for name in raw})
 def wheel(self,path,raw,*,change=None):
  with zipfile.ZipFile(path,'w') as z:
   for name in gate.MODULES:
    if change==('missing',name):continue
    z.writestr(name,raw['python/'+name]+(b'\r' if change==('changed',name) else b''))
   if change and change[0]=='extra':z.writestr(change[1],b'VALUE=1\n')
 def test_wheel_checks_exact_bytes_and_closed_python_namespace(self):
  raw=self.raw()
  with tempfile.TemporaryDirectory() as tmp:
   p=pathlib.Path(tmp)/'sdk.whl';self.wheel(p,raw);self.assertEqual(len(gate.verify_wheel(p,raw)),3)
   for change in [('missing','market_math.py'),('changed','market_math.py'),('extra','market_profile_math.py'),('extra','foreign.py')]:
    self.wheel(p,raw,change=change)
    with self.assertRaises(ValueError):gate.verify_wheel(p,raw)
 def sdist(self,path,raw,*,change=None):
  with tarfile.open(path,'w:gz') as t:
   for name,data in raw.items():
    if change==('missing',name):continue
    data=data+(b'\r' if change==('changed',name) else b'');m=tarfile.TarInfo('sdk-0.1.0/'+name);m.size=len(data);t.addfile(m,io.BytesIO(data))
   if change and change[0]=='duplicate':
    name=change[1];data=raw[name];m=tarfile.TarInfo('sdk-0.1.0/'+name);m.size=len(data);t.addfile(m,io.BytesIO(data))
 def test_sdist_checks_raw_source_not_just_wheel_or_hash_labels(self):
  raw=self.raw()
  with tempfile.TemporaryDirectory() as tmp:
   p=pathlib.Path(tmp)/'sdk.tar.gz';self.sdist(p,raw);self.assertEqual(len(gate.verify_sdist(p,raw)),4)
   for change in [('missing','pyproject.toml'),('changed','python/market_math.py'),('duplicate','python/market_math.py')]:
    self.sdist(p,raw,change=change)
    with self.assertRaises(ValueError):gate.verify_sdist(p,raw)
