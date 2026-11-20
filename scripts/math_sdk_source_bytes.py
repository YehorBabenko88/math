"""Raw SDK checkout/archive identity; never normalize historical numerical bytes."""
import pathlib,tarfile,zipfile,hashlib
SDK_FILES=('pyproject.toml','python/market_math.py','python/market_compute_api.py','python/history_statistics.py')
MODULES=tuple(pathlib.PurePosixPath(name).name for name in SDK_FILES if name.startswith('python/'))
def require_checkout(committed,current):
 if set(committed)!=set(SDK_FILES) or set(current)!=set(SDK_FILES):raise ValueError('MATH_SDK_FILE_SET')
 for name in SDK_FILES:
  if type(committed[name]) is not bytes or type(current[name]) is not bytes or current[name]!=committed[name]:raise ValueError('MATH_SDK_RAW_CHECKOUT_MISMATCH:'+name)
def materialize(committed,destination):
 require_checkout(committed,committed)
 for name in SDK_FILES:
  target=pathlib.Path(destination)/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(committed[name])
def verify_wheel(path,committed):
 require_checkout(committed,committed)
 with zipfile.ZipFile(path) as archive:
  names=[item.filename for item in archive.infolist() if item.filename.endswith(('.py','.pyc','.pyo'))]
  if sorted(names)!=sorted(MODULES):raise ValueError('MATH_SDK_WHEEL_NAMESPACE')
  for name in MODULES:
   if archive.read(name)!=committed['python/'+name]:raise ValueError('MATH_SDK_WHEEL_RAW_MISMATCH:'+name)
 return {name:hashlib.sha256(committed['python/'+name]).hexdigest() for name in MODULES}
def verify_sdist(path,committed):
 require_checkout(committed,committed);seen={}
 with tarfile.open(path,'r:gz') as archive:
  for member in archive:
   parts=pathlib.PurePosixPath(member.name).parts
   relative='/'.join(parts[1:])
   if relative not in SDK_FILES:continue
   if relative in seen or not member.isfile() or member.size!=len(committed[relative]):raise ValueError('MATH_SDK_SDIST_MEMBER:'+relative)
   stream=archive.extractfile(member)
   if stream is None or stream.read()!=committed[relative]:raise ValueError('MATH_SDK_SDIST_RAW_MISMATCH:'+relative)
   seen[relative]=hashlib.sha256(committed[relative]).hexdigest()
 if set(seen)!=set(SDK_FILES):raise ValueError('MATH_SDK_SDIST_FILES_MISSING')
 return seen
