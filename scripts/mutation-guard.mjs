import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { matchesGlob } from 'node:path';

// Fails when a production file changed since a base leaves a mutant alive (contract: decision #104 of docs/decisions/DECISIONS.md).

const STRYKER = 'node_modules/@stryker-mutator/core/bin/stryker.js';
const REPORT = 'reports/mutation/mutation.json';
const ACCEPTED = new Set(['Killed', 'Timeout', 'CompileError']);
const STATIC_REASON = 'Static mutant (and "ignoreStatic" was enabled)';
const SWITCH_OFF = /stryker\s+(disable|restore)/i;

function fail(message) {
    console.error(message);
    process.exit(1);
}

function changedProductionFiles(base) {
    const patterns = JSON.parse(readFileSync('stryker.config.json', 'utf8')).mutate;
    const included = patterns.filter((pattern) => !pattern.startsWith('!'));
    const excluded = patterns.filter((pattern) => pattern.startsWith('!')).map((pattern) => pattern.slice(1));
    const run = spawnSync('git', ['diff', '--name-only', '--diff-filter=ACMR', `${base}...HEAD`], { encoding: 'utf8' });
    if (run.status !== 0) fail(`Cannot list the files changed since ${base}:\n${run.stderr}`);
    return run.stdout.split('\n').filter((file) => included.some((glob) => matchesGlob(file, glob)) && !excluded.some((glob) => matchesGlob(file, glob)));
}

function switchedOff(files) {
    return files.flatMap((file) => readFileSync(file, 'utf8').split('\n')
        .flatMap((text, index) => (SWITCH_OFF.test(text) ? [`${file}:${index + 1} switches mutation off`] : [])));
}

function runMutationTool(files) {
    rmSync(REPORT, { force: true });
    const run = spawnSync(process.execPath, [STRYKER, 'run', '--mutate', files.join(',')], { stdio: 'inherit' });
    if (run.status !== 0) fail(`The mutation tool failed (exit ${run.status}).`);
    if (!existsSync(REPORT)) fail('The mutation tool wrote no report.');
    return JSON.parse(readFileSync(REPORT, 'utf8')).files;
}

function notKilled(reportFiles) {
    const isAccepted = ({ status, statusReason }) => ACCEPTED.has(status) || (status === 'Ignored' && statusReason === STATIC_REASON);
    return Object.entries(reportFiles).flatMap(([file, { mutants }]) => mutants
        .filter((mutant) => !isAccepted(mutant))
        .map(({ status, mutatorName, replacement, location }) => `${file}:${location.start.line} ${status} ${mutatorName} => ${replacement}`));
}

const base = process.argv[2] === '--base' ? process.argv[3] : undefined;
if (base === undefined) fail('Usage: mutation-guard --base <ref>');

const files = changedProductionFiles(base);
if (files.length === 0) {
    console.log('No production file changed: no mutation to check.');
    process.exit(0);
}

const comments = switchedOff(files);
if (comments.length > 0) fail(comments.join('\n'));

const refused = notKilled(runMutationTool(files));
if (refused.length > 0) fail(`${refused.length} mutant(s) not killed in the changed files:\n${refused.join('\n')}`);
console.log('No surviving mutant in the changed files.');
