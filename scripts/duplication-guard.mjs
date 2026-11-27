import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Fails when a duplication check can be switched off (contract: decisions #108 and #109 of docs/decisions/DECISIONS.md):
// a comment that tells jscpd to ignore code, or a configuration under which a new duplicated block no longer fails the check.

const JSCPD = fileURLToPath(new URL('../node_modules/jscpd/run-jscpd.js', import.meta.url));
const SWITCH_OFF = /jscpd:ignore/;
// Each check is replayed on two identical files that its configuration must analyse: the tests check reports a new block as [NEW]
// (it has a baseline), the production check, which tolerates nothing, reports any block as a clone.
const isTestFile = (path) => path.endsWith('.test.ts') || path.startsWith('test-support/') || path.includes('/test-support/');
const CHECKS = [
    { configuration: '.jscpd.tests.json', copied: ['.jscpd.tests.json', '.jscpd.tests.baseline.json'], files: ['first.test.ts', 'second.test.ts'], clone: '[NEW]', owns: isTestFile, allowed: ['path', 'pattern', 'baseline', 'failOnNewClones', 'failOnEmpty'] },
    { configuration: '.jscpd.production.json', copied: ['.jscpd.production.json'], files: ['first.ts', 'second.ts'], clone: 'Clone found', owns: (path) => !isTestFile(path), allowed: ['path', 'ignore', 'exitCode', 'failOnEmpty'] }
];
const SOURCE = /\.(ts|mjs)$/;
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

function replayOnAWitness({ configuration, copied, files, clone }) {
    const folder = mkdtempSync(join(tmpdir(), 'duplication-witness-'));
    try {
        for (const file of copied) copyFileSync(file, join(folder, file));
        mkdirSync(join(folder, 'src'));
        for (const name of files) writeFileSync(join(folder, 'src', name), WITNESS);
        const run = spawnSync(process.execPath, [JSCPD, '--config', configuration], { cwd: folder, encoding: 'utf8' });
        const output = run.stdout + run.stderr;
        return run.status === 1 && output.includes(clone) ? [] : [`${configuration} does not fail on a new duplicated block (jscpd exit ${run.status}):\n${output}`];
    } finally {
        rmSync(folder, { recursive: true, force: true });
    }
}

// Run with a threshold of one token and one line, jscpd counts every file the configuration lets through (the real thresholds skip the short ones).
function analysedFiles(configuration) {
    const folder = mkdtempSync(join(tmpdir(), 'duplication-report-'));
    try {
        const run = spawnSync(process.execPath, [JSCPD, '--config', configuration, '-k', '1', '-l', '1', '--reporters', 'json', '--output', folder], { encoding: 'utf8' });
        const report = join(folder, 'jscpd-report.json');
        return existsSync(report) ? JSON.parse(readFileSync(report, 'utf8')).statistics.total.sources : `no file (no report, jscpd exit ${run.status}):\n${run.stdout + run.stderr}`;
    } finally {
        rmSync(folder, { recursive: true, force: true });
    }
}

function filesOfSrc() {
    return readdirSync('src', { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => relative('src', join(entry.parentPath, entry.name)).split(sep).join('/'))
        .filter((path) => SOURCE.test(path));
}

function countProblems({ configuration, owns }) {
    const expected = filesOfSrc().filter(owns).length;
    const analysed = analysedFiles(configuration);
    return analysed === expected ? [] : [`${configuration} analyses ${analysed} files of src, ${expected} expected`];
}

function keyProblems({ configuration, allowed }) {
    return Object.keys(JSON.parse(readFileSync(configuration, 'utf8')))
        .filter((key) => !allowed.includes(key))
        .map((key) => `${configuration} holds the key '${key}', which the guard does not allow`);
}

const problems = [...switchedOff('src'), ...CHECKS.flatMap(replayOnAWitness), ...CHECKS.flatMap(countProblems), ...CHECKS.flatMap(keyProblems)];
if (problems.length > 0) {
    console.error(problems.join('\n'));
    process.exit(1);
}
console.log('No duplication check is switched off.');
