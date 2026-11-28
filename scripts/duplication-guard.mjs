import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Fails when a duplication check can be switched off (contract: decisions #108 and #109 of docs/decisions/DECISIONS.md):
// a comment that tells jscpd to ignore code, a configuration under which a new duplicated block no longer fails the check,
// a configuration under which the check analyses fewer files of src than it should, or a configuration key that is not allowed.

const JSCPD = fileURLToPath(new URL('../node_modules/jscpd/run-jscpd.js', import.meta.url));
const SWITCH_OFF = /jscpd:ignore/;
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
// The same witness with every identifier renamed: only a check that ignores identifiers reports it as a copy of WITNESS.
const RENAMED_WITNESS = WITNESS.replace(/\btotal\b/g, 'aggregate').replace(/\bvalues\b/g, 'numbers').replace(/\bvalue\b/g, 'item').replace(/\bsum\b/g, 'result');

// Each check is replayed on two files that its configuration must analyse: the tests check reports a new block as [NEW]
// (it has a baseline), the production check, which tolerates nothing, reports any block as a clone. The tests check is replayed
// on two identical files, the production check on two files that differ only by their identifiers (it must see a copy up to a
// name, decision #113). `owns` says which files of src (path relative to src, separators `/`) the check must analyse;
// `allowed` lists its configuration keys, any other (a threshold, a misspelling that jscpd accepts without effect) is refused.
const isTestFile = (path) => path.endsWith('.test.ts') || path.startsWith('test-support/') || path.includes('/test-support/');
const CHECKS = [
    { configuration: '.jscpd.tests.json', copied: ['.jscpd.tests.json', '.jscpd.tests.baseline.json'], files: ['first.test.ts', 'second.test.ts'], contents: [WITNESS, WITNESS], clone: '[NEW]', owns: isTestFile, allowed: ['path', 'pattern', 'baseline', 'failOnNewClones', 'failOnEmpty'] },
    { configuration: '.jscpd.production.json', copied: ['.jscpd.production.json'], files: ['first.ts', 'second.ts'], contents: [WITNESS, RENAMED_WITNESS], clone: 'Clone found', owns: (path) => !isTestFile(path), allowed: ['path', 'ignore', 'exitCode', 'ignoreIdentifiers', 'failOnEmpty'] }
];

function switchedOff(folder) {
    return readdirSync(folder, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile()).flatMap((entry) => {
        const file = join(entry.parentPath, entry.name);
        return readFileSync(file, 'utf8').split('\n')
            .flatMap((text, index) => (SWITCH_OFF.test(text) ? [`${file}:${index + 1} switches a duplication check off`] : []));
    });
}

function inTemporaryFolder(prefix, use) {
    const folder = mkdtempSync(join(tmpdir(), prefix));
    try {
        return use(folder);
    } finally {
        rmSync(folder, { recursive: true, force: true });
    }
}

function replayOnAWitness({ configuration, copied, files, contents, clone }) {
    return inTemporaryFolder('duplication-witness-', (folder) => {
        for (const file of copied) copyFileSync(file, join(folder, file));
        mkdirSync(join(folder, 'src'));
        files.forEach((name, index) => writeFileSync(join(folder, 'src', name), contents[index]));
        const run = spawnSync(process.execPath, [JSCPD, '--config', configuration], { cwd: folder, encoding: 'utf8' });
        const output = run.stdout + run.stderr;
        return run.status === 1 && output.includes(clone) ? [] : [`${configuration} does not fail on a new duplicated block (jscpd exit ${run.status}):\n${output}`];
    });
}

// Run with a threshold of one token and one line, jscpd counts every file the configuration lets through (the real thresholds skip the short ones).
function analysedFiles(configuration) {
    return inTemporaryFolder('duplication-report-', (folder) => {
        const run = spawnSync(process.execPath, [JSCPD, '--config', configuration, '-k', '1', '-l', '1', '--reporters', 'json', '--output', folder], { encoding: 'utf8' });
        const report = join(folder, 'jscpd-report.json');
        return existsSync(report)
            ? { count: JSON.parse(readFileSync(report, 'utf8')).statistics.total.sources, said: '' }
            : { count: 'no', said: `\n(no report, jscpd exit ${run.status}):\n${run.stdout + run.stderr}` };
    });
}

function filesOfSrc() {
    return readdirSync('src', { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => relative('src', join(entry.parentPath, entry.name)).split(sep).join('/'))
        .filter((path) => SOURCE.test(path));
}

function countProblems({ configuration, owns }) {
    const expected = filesOfSrc().filter(owns).length;
    const { count, said } = analysedFiles(configuration);
    return count === expected ? [] : [`${configuration} analyses ${count} files of src, ${expected} expected${said}`];
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
