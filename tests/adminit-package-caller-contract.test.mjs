import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const verifier=readFileSync(new URL('../scripts/adminit-containment/verify-adminit.ps1',import.meta.url),'utf8');
const packageSource=readFileSync(new URL('../scripts/adminit-containment/package.mjs',import.meta.url),'utf8');
test('PowerShell read-only verifier requires external tree argument',()=>{
 assert.match(verifier,/\[Parameter\(Mandatory=\$true\)\]\[string\]\$ExpectedSourceTree/);
 assert.match(verifier,/package\.mjs'\) \$PackageRoot \$ExpectedManifestSha256 \$ExpectedSourceHead \$ExpectedSourceTree/);
});
test('Execute remains unconditionally blocked before any package verification',()=>{
 const gate=verifier.indexOf("if($Execute){throw");
 const call=verifier.indexOf("'package.mjs'");
 assert.ok(gate>=0&&call>gate);
});
test('package CLI requires external source tree and qualified verifier',()=>{
 assert.match(packageSource,/process\.argv\.length===6/);
 assert.match(packageSource,/verifyAdminitPackageQualified\(\{directory:/);
});
test('future verify-only packet supplies external tree and avoids historical laboratory',()=>{const s=readFileSync(new URL('../docs/audits/PR51_CURRENT_VERIFY_ONLY_PACKET.md',import.meta.url),'utf8');const packet=s;assert.match(packet,/-ExpectedSourceHead \$ExpectedHead -ExpectedSourceTree \$ExpectedTree/);assert.match(packet,/MathUniverseAdminitAcceptance/);assert.doesNotMatch(packet,/MathUniverseLab\\AdminitSynthetic/);});
