import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { matchesGlob } from 'node:path';

const base = process.argv[process.argv.indexOf('--base') + 1];
const patterns = JSON.parse(readFileSync('stryker.config.json', 'utf8')).mutate;
const included = patterns.filter((pattern) => !pattern.startsWith('!'));
const excluded = patterns.filter((pattern) => pattern.startsWith('!')).map((pattern) => pattern.slice(1));
const isMutated = (file) => included.some((glob) => matchesGlob(file, glob)) && !excluded.some((glob) => matchesGlob(file, glob));

const changed = execFileSync('git', ['diff', '--name-only', '--diff-filter=ACMR', `${base}...HEAD`], { encoding: 'utf8' })
    .split('\n')
    .filter((file) => file !== '' && isMutated(file));

if (changed.length === 0) {
    console.log('No production file changed: no mutation to check.');
}
