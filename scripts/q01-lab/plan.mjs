// A versioned, external-to-results inventory. Never infer completeness from successes.
export const contract='math-q01-laboratory/v1';
export const profiles={
 quick:['concurrent-first-open-10','stale-exists-false','schema-metadata','atomic-claims','lease-checkpoint','unicode-roundtrip','idempotence'],
 fault:['existing-empty','initialization-1s','initialization-timeout-6.5s','lock-4.5s','lock-timeout-5.5s','pause-before-commit','crash-before-commit','crash-after-commit','crash-after-delete','crash-after-insert','crash-initialization','rollback-write-error','read-error','malformed-schema','wrong-metadata-version','missing-metadata','corrupt-payload','incorrect-types','multiwriter','crash-checkpoint-resume','restart-after-timeout','diagnostic-first-open-100'],
 copy:['copy-first-open-3000'],
 passive:['passive-first-open-3000'],
 forensic:['diagnostic-first-open-3000'],
 stress:['concurrent-first-open-100','concurrent-first-open-300','concurrent-first-open-1000']
};
export function expectedCasesForProfile(profile){if(!Object.hasOwn(profiles,profile))throw Error('Unknown laboratory profile');return [...profiles[profile]];}
export const caseDeadlineMs=60000;
export const workerDeadlineMs=25000;
