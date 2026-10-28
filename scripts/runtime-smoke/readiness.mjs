// No accepted independent controller exists. No argument can unlock a launch.
import {lockedHostResult} from './host-controller-contract.mjs';
console.log(JSON.stringify(lockedHostResult()));
process.exitCode=2;
