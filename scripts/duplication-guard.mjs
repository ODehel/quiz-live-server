import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Fails when a duplication check of the tests can be switched off (contract: decision #108 of docs/decisions/DECISIONS.md):
// a comment that tells jscpd to ignore code, or a configuration under which a new duplicated block no longer fails the check.

const JSCPD = fileURLToPath(new URL('../node_modules/jscpd/run-jscpd.js', import.meta.url));
const SWITCH_OFF = /jscpd:ignore/;
const CONFIGURATION = '.jscpd.tests.json';
const BASELINE = '.jscpd.tests.baseline.json';
const WITNESS = `export function total(values: number[]): number {
    let sum = 0;
    for (const value of values) {
        if (value > 10) {
            sum += value * 2;
        } else {
            sum -= value + 1;
        }
    }
    return sum;
}
`;

function switchedOff(folder) {
    return readdirSync(folder, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile()).flatMap((entry) => {
        const file = join(entry.parentPath, entry.name);
        return readFileSync(file, 'utf8').split('\n')
            .flatMap((text, index) => (SWITCH_OFF.test(text) ? [`${file}:${index + 1} switches a duplication check off`] : []));
    });
}

function replayOnAWitness() {
    const folder = mkdtempSync(join(tmpdir(), 'duplication-witness-'));
    try {
        for (const file of [CONFIGURATION, BASELINE]) copyFileSync(file, join(folder, file));
        mkdirSync(join(folder, 'src'));
        for (const name of ['first', 'second']) writeFileSync(join(folder, 'src', `${name}.test.ts`), WITNESS);
        const run = spawnSync(process.execPath, [JSCPD, '--config', CONFIGURATION], { cwd: folder, encoding: 'utf8' });
        const output = run.stdout + run.stderr;
        return run.status === 1 && output.includes('[NEW]') ? [] : [`${CONFIGURATION} does not fail on a new duplicated block (jscpd exit ${run.status}):\n${output}`];
    } finally {
        rmSync(folder, { recursive: true, force: true });
    }
}

const problems = [...switchedOff('src'), ...replayOnAWitness()];
if (problems.length > 0) {
    console.error(problems.join('\n'));
    process.exit(1);
}
console.log('No duplication check is switched off.');
