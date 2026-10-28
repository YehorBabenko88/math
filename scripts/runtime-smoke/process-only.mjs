// Fixed VM-only phase-one payload. No imports, host inspection or Token API.
// Presence of this file does not authorize running it on ADMINIT or another host.
if(process.platform!=='win32'||process.argv.length!==2)process.exitCode=2;
else process.stdout.write('MATH_UNIVERSE_PROCESS_ONLY_V1\n');
