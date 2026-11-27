import test from 'node:test';
import assert from 'node:assert/strict';
import {createExperimentLedger} from '../src/experiment/postgres-ledger.mjs';
// No automatic connection, migration or credentials. Live acceptance requires reviewed fixture provisioning.
test('disposable PostgreSQL 18 concurrent reservation/start/terminal CAS', {skip:'Requires reviewed disposable PG18 fixture, role grants and hardened codec; live harness not yet implemented'},()=>{assert.equal(typeof createExperimentLedger,'function');});
