"""Explicitly regenerate only the new-source custody; frozen ledgers unchanged."""
import hashlib
import json
from pathlib import Path

root=Path(__file__).resolve().parents[1]
proof=json.loads((root/'scripts/platform-current-source-proof.json').read_text())
files={}
for path in sorted((root/'tests').rglob('*.mjs')):
    name=path.relative_to(root).as_posix()
    if path.name.endswith(('.test.mjs','.windows.mjs','.cross.mjs')) and name not in proof['files']:
        files[name]=hashlib.sha256(path.read_bytes()).hexdigest()
manifest={'schema':'math.round21.test-source-extension.v1',
          'base':'26a692974768d14de847de0d05244cb9b39667f3',
          'runtimeCoverage':'SEPARATE_REQUIRED','files':files}
(root/'scripts/platform-round21-source-extension.json').write_bytes((json.dumps(manifest,indent=2)+'\n').encode())
print('New source custody files:',len(files))
