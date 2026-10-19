// Synthetic fixture only: execute these exact SQL bytes and record their digest
// in the same transaction. Never backfill an unknown deployed history this way.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {migrationBody} from '../../src/postgres-migrations.mjs';
export async function seedExecutedBookMigrations(pool,names){
 const client=await pool.connect();try{await client.query('BEGIN');
 await client.query("CREATE TABLE mu_book_schema_migrations(filename text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now(),sha256 text NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),hash_contract text NOT NULL CHECK(hash_contract='sha256-raw-utf8/v1'))");
 for(const name of names){const bytes=await readFile(new URL('../../sql/book/'+name,import.meta.url));await client.query(migrationBody(bytes.toString('utf8'),name));await client.query('INSERT INTO mu_book_schema_migrations(filename,sha256,hash_contract) VALUES($1,$2,$3)',[name,createHash('sha256').update(bytes).digest('hex'),'sha256-raw-utf8/v1']);}
 await client.query('COMMIT');}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
