import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { matchesGlob } from 'node:path';

const STRYKER = 'node_modules/@stryker-mutator/core/bin/stryker.js';
const REPORT = 'reports/mutation/mutation.json';
const ACCEPTED = new Set(['Killed', 'Timeout', 'CompileError']);
const STATIC_REASON = 'Static mutant (and "ignoreStatic" was enabled)';

const base = process.argv[process.argv.indexOf('--base') + 1];
const patterns = JSON.parse(readFileSync('stryker.config.json', 'utf8')).mutate;
const included = patterns.filter((pattern) => !pattern.startsWith('!'));
const excluded = patterns.filter((pattern) => pattern.startsWith('!')).map((pattern) => pattern.slice(1));
const isMutated = (file) => included.some((glob) => matchesGlob(file, glob)) && !excluded.some((glob) => matchesGlob(file, glob));
const isAccepted = ({ status, statusReason }) => ACCEPTED.has(status) || (status === 'Ignored' && statusReason === STATIC_REASON);

const changed = execFileSync('git', ['diff', '--name-only', '--diff-filter=ACMR', `${base}...HEAD`], { encoding: 'utf8' })
    .split('\n')
    .filter((file) => file !== '' && isMutated(file));

if (changed.length === 0) {
    console.log('No production file changed: no mutation to check.');
    process.exit(0);
}

spawnSync(process.execPath, [STRYKER, 'run', '--mutate', changed.join(',')], { stdio: 'inherit' });
const { files } = JSON.parse(readFileSync(REPORT, 'utf8'));
const refused = Object.entries(files).flatMap(([file, { mutants }]) => mutants
    .filter((mutant) => !isAccepted(mutant))
    .map(({ status, mutatorName, replacement, location }) => `${file}:${location.start.line} ${status} ${mutatorName} => ${replacement}`));

if (refused.length > 0) {
    console.error(`${refused.length} mutant(s) not killed in the changed files:\n${refused.join('\n')}`);
    process.exit(1);
}
console.log('No surviving mutant in the changed files.');
