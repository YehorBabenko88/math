// No controller exists yet. No option or environment value unlocks execution.
import {lockedRuntimeReport} from './contract.mjs';
console.log(JSON.stringify(lockedRuntimeReport()));
process.exitCode=2;
