import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';

// The duplication guard (`npm run duplication:guard`) is proved here on throwaway trees: each one holds the real configuration
// and baseline of the test check, and the files the case describes. The guard reads the tree it is run in and must fail the command
// when a comment switches a duplication check off in `src`, or when the test check no longer fails on a new duplicated block.

const ROOT = resolve(__dirname, '..');
const SCRIPT = join(ROOT, 'scripts/duplication-guard.mjs');
const CONFIGURATION = readFileSync(join(ROOT, '.jscpd.tests.json'), 'utf8');
const PRODUCTION = readFileSync(join(ROOT, '.jscpd.production.json'), 'utf8');
const BASELINE = readFileSync(join(ROOT, '.jscpd.tests.baseline.json'), 'utf8');
// Built at run time: the guard reads this very file, and jscpd honours the marker even inside a string.
const marker = (kind: string) => ['jscpd', `ignore-${kind}`].join(':');
const MARKER = marker('start');

const trees: string[] = [];

afterEach(() => {
    for (const tree of trees.splice(0)) rmSync(tree, { recursive: true, force: true });
});

function treeOf(files: Record<string, string>, configuration = CONFIGURATION, production = PRODUCTION): string {
    const tree = mkdtempSync(join(tmpdir(), 'duplication-guard-'));
    trees.push(tree);
    for (const [path, content] of Object.entries({ '.jscpd.tests.json': configuration, '.jscpd.production.json': production, '.jscpd.tests.baseline.json': BASELINE, ...files })) {
        mkdirSync(dirname(join(tree, path)), { recursive: true });
        writeFileSync(join(tree, path), content);
    }
    return tree;
}

function guard(tree: string): { status: number | null; output: string } {
    const run = spawnSync(process.execPath, [SCRIPT], { cwd: tree, encoding: 'utf8' });
    return { status: run.status, output: run.stdout + run.stderr };
}

describe('a tree where no duplication check is switched off', () => {
    it('passes the guard', () => {
        const run = guard(treeOf({ 'src/themes/a.ts': 'export const value = 1\n' }));
        expect(run.status).toBe(0);
    });
});

describe('a tree where a comment switches a duplication check off', () => {
    it('fails the guard and names the file and the line', () => {
        const run = guard(treeOf({ 'src/themes/a.ts': `export const value = 1\n// ${MARKER}\n` }));
        expect(run.status).toBe(1);
        expect(run.output).toContain(`${join('src', 'themes', 'a.ts')}:2 switches a duplication check off`);
    });
});

const SWITCHING_OFF: [string, string][] = [
    ['a production file', 'src/themes/a.ts'],
    ['a test', 'src/themes/a.test.ts'],
    ['a file of src/test-support', 'src/test-support/helper.mjs'],
    ['a file directly in src', 'src/a.ts']
];

describe('which files of the tree the guard reads', () => {
    it.each(SWITCHING_OFF)('refuses a marker in %s', (_name, path) => {
        const run = guard(treeOf({ [path]: `// ${MARKER}\n` }));
        expect([run.status, run.output]).toEqual([1, expect.stringContaining(`${join(...path.split('/'))}:1 switches a duplication check off`)]);
    });

    it('accepts a marker outside src, which no duplication check reads', () => {
        const run = guard(treeOf({ 'src/themes/a.ts': 'export const value = 1\n', 'scripts/a.mjs': `// ${MARKER}\n`, 'docs/a.md': `${MARKER}\n`, 'a.ts': `// ${MARKER}\n` }));
        expect(run.status).toBe(0);
    });
});

describe('which markers the guard refuses', () => {
    it.each(['start', 'end', 'next-line'])('refuses the marker of kind %s', (kind) => {
        const run = guard(treeOf({ 'src/a.ts': `export const value = 1\n// ${marker(kind)}\n` }));
        expect([run.status, run.output]).toEqual([1, expect.stringContaining(`${join('src', 'a.ts')}:2 `)]);
    });

    it.each([
        ['a block comment', '/* MARKER */'],
        ['the end of a line of code', 'export const value = 1 // MARKER'],
        ['a string, where jscpd honours it too', "export const text = 'MARKER'"]
    ])('refuses a marker in %s', (_name, line) => {
        const run = guard(treeOf({ 'src/a.ts': `${line.replace('MARKER', MARKER)}\n` }));
        expect(run.status).toBe(1);
    });

    it('names every line that holds a marker, in every file', () => {
        const run = guard(treeOf({ 'src/a.ts': `// ${MARKER}\nexport const value = 1\n// ${MARKER}\n`, 'src/b.ts': `// ${MARKER}\n` }));
        expect(run.output.split('\n').filter((line) => line.includes('switches a duplication check off')).sort()).toEqual([
            `${join('src', 'a.ts')}:1 switches a duplication check off`,
            `${join('src', 'a.ts')}:3 switches a duplication check off`,
            `${join('src', 'b.ts')}:1 switches a duplication check off`
        ]);
    });
});

const configured = (changes: Record<string, unknown>) => JSON.stringify({ ...(JSON.parse(CONFIGURATION) as object), ...changes });
const REFUSED = '.jscpd.tests.json does not fail on a new duplicated block';

describe('a test check that no longer fails on a new duplicated block', () => {
    it('fails the guard when the key that counts the new blocks is absent', () => {
        const run = guard(treeOf({ 'src/themes/a.ts': 'export const value = 1\n' }, configured({ failOnNewClones: undefined })));
        expect(run.status).toBe(1);
        expect(run.output).toContain(REFUSED);
    });
});

const NO_LONGER_FAILING: [string, Record<string, unknown>, number, string][] = [
    ['misspelled, which jscpd accepts', { failOnNewClones: undefined, failOnNewClone: 0 }, 0, "unknown field 'failOnNewClone'"],
    ['1, which one new block does not exceed', { failOnNewClones: 1 }, 0, '[NEW]'],
    ['a string, which jscpd rejects as a configuration', { failOnNewClones: '0' }, 1, 'invalid type']
];

describe('a test check that no longer fails on a new duplicated block, whatever the reason', () => {
    it.each(NO_LONGER_FAILING)('fails the guard when the key is %s', (_name, changes, status, said) => {
        const run = guard(treeOf({ 'src/themes/a.ts': 'export const value = 1\n' }, configured(changes)));
        expect([run.status, run.output]).toEqual([1, expect.stringContaining(`${REFUSED} (jscpd exit ${status})`)]);
        expect(run.output).toContain(said);
    });
});

const producing = (changes: Record<string, unknown>) => JSON.stringify({ ...(JSON.parse(PRODUCTION) as object), ...changes });
const PRODUCTION_REFUSED = '.jscpd.production.json does not fail on a new duplicated block';

const PRODUCTION_NO_LONGER_FAILING: [string, Record<string, unknown>, number, string][] = [
    ['the key `exitCode` is absent', { exitCode: undefined }, 0, 'Clone found'],
    ['the key `exitCode` is misspelled, which jscpd accepts', { exitCode: undefined, exitCod: 1 }, 0, "unknown field 'exitCod'"],
    ['the key `exitCode` is 0, which jscpd reads as success', { exitCode: 0 }, 0, 'Clone found'],
    ['the key `exitCode` is 2, which is not the code the build waits for', { exitCode: 2 }, 2, 'Clone found'],
    ['`ignore` hides the witness, so no block is found', { ignore: ['**/*.ts'] }, 1, 'analyzed no files'],
    ['the key `ignoreIdentifiers` is absent, so a copy up to a name is no clone', { ignoreIdentifiers: undefined }, 0, 'Found 0 clones'],
    ['the key `ignoreIdentifiers` is misspelled, which jscpd accepts', { ignoreIdentifiers: undefined, ignoreIdentifier: true }, 0, "unknown field 'ignoreIdentifier'"],
    ['the key `ignoreIdentifiers` is false', { ignoreIdentifiers: false }, 0, 'Found 0 clones'],
    ['the key `ignoreIdentifiers` is a string, which jscpd rejects as a configuration', { ignoreIdentifiers: 'true' }, 1, 'expected true, false, "blind" or "consistent"']
];

describe('a production check that no longer fails on a new duplicated block', () => {
    it.each(PRODUCTION_NO_LONGER_FAILING)('fails the guard when %s', (_name, changes, status, said) => {
        const run = guard(treeOf({ 'src/themes/a.ts': 'export const value = 1\n' }, CONFIGURATION, producing(changes)));
        expect([run.status, run.output]).toEqual([1, expect.stringContaining(`${PRODUCTION_REFUSED} (jscpd exit ${status})`)]);
        expect(run.output).toContain(said);
    });
});

const LONE = 'export const value = 1\n';
const PRODUCTION_IGNORE = (JSON.parse(PRODUCTION) as { ignore: string[] }).ignore;
const HIDING_FILES: [string, Record<string, string>, string, string, string][] = [
    ['`ignore` hides a folder from the tests check', { 'src/themes/a.test.ts': LONE, 'src/b.test.ts': LONE }, configured({ ignore: ['**/themes/**'] }), PRODUCTION, '.jscpd.tests.json analyses 1 files of src, 2 expected'],
    ['`ignore` hides a folder from the production check', { 'src/themes/a.ts': LONE, 'src/b.ts': LONE }, CONFIGURATION, producing({ ignore: [...PRODUCTION_IGNORE, '**/themes/**'] }), '.jscpd.production.json analyses 1 files of src, 2 expected'],
    ['`pattern` leaves out src/test-support in the tests check', { 'src/a.test.ts': LONE, 'src/test-support/helper.mjs': LONE }, configured({ pattern: '**/*.test.ts' }), PRODUCTION, '.jscpd.tests.json analyses 1 files of src, 2 expected'],
    ['`path` narrows the tests check to a folder', { 'src/themes/a.test.ts': LONE, 'src/b.test.ts': LONE }, configured({ path: ['src/themes'] }), PRODUCTION, '.jscpd.tests.json analyses 1 files of src, 2 expected'],
    ['`path` narrows the production check to a folder', { 'src/themes/a.ts': LONE, 'src/b.ts': LONE }, CONFIGURATION, producing({ path: ['src/themes'] }), '.jscpd.production.json analyses 1 files of src, 2 expected'],
    ['`ignore` no longer leaves src/test-support out of the production check', { 'src/a.ts': LONE, 'src/test-support/helper.mjs': LONE }, CONFIGURATION, producing({ ignore: ['**/*.test.ts'] }), '.jscpd.production.json analyses 2 files of src, 1 expected']
];

describe('a check that stops analysing files of src', () => {
    it.each(HIDING_FILES)('fails the guard when %s', (_name, files, tests, production, said) => {
        const run = guard(treeOf(files, tests, production));
        expect([run.status, run.output]).toEqual([1, expect.stringContaining(said)]);
    });

    it('fails the guard on an empty file of src, which jscpd does not count', () => {
        const run = guard(treeOf({ 'src/a.test.ts': LONE, 'src/empty.test.ts': '' }));
        expect([run.status, run.output]).toEqual([1, expect.stringContaining('.jscpd.tests.json analyses 1 files of src, 2 expected')]);
    });

    it('passes the guard when every file lies where its check expects it, at the root of src or deeper', () => {
        const files = ['src/a.test.ts', 'src/themes/b.test.ts', 'src/test-support/c.mjs', 'src/themes/test-support/d.ts', 'src/e.ts', 'src/themes/f.ts'];
        const run = guard(treeOf(Object.fromEntries(files.map((file) => [file, LONE]))));
        expect(run.status).toBe(0);
    });
});

const WITH_OTHER_KEYS: [string, string, string, string, string][] = [
    ['a token threshold the production witness still exceeds', '.jscpd.production.json', 'minTokens', CONFIGURATION, producing({ minTokens: 52 })],
    ['a line threshold the tests witness still exceeds', '.jscpd.tests.json', 'minLines', configured({ minLines: 6 }), PRODUCTION],
    ['a token threshold the tests witness still exceeds', '.jscpd.tests.json', 'minTokens', configured({ minTokens: 52 }), PRODUCTION],
    ['a line threshold the production witness still exceeds', '.jscpd.production.json', 'minLines', CONFIGURATION, producing({ minLines: 6 })],
    ['a key that jscpd does not know, which it accepts', '.jscpd.tests.json', 'failOnEmpt', configured({ failOnEmpt: true }), PRODUCTION]
];

describe('a configuration that jscpd rejects', () => {
    it('fails the guard with the output of jscpd, since it wrote no report to count', () => {
        const run = guard(treeOf({ 'src/themes/a.test.ts': LONE }, configured({ failOnNewClones: '0' })));
        expect(run.output).toContain(".jscpd.tests.json analyses no files of src, 1 expected\n(no report, jscpd exit 1):");
        expect(run.output).toContain('invalid type');
    });
});

describe('a configuration that holds a key the guard does not allow', () => {
    it.each(WITH_OTHER_KEYS)('fails the guard on %s', (_name, configuration, key, tests, production) => {
        const run = guard(treeOf({ 'src/themes/a.ts': LONE }, tests, production));
        expect([run.status, run.output]).toEqual([1, expect.stringContaining(`${configuration} holds the key '${key}', which the guard does not allow`)]);
    });
});

describe('where the guard runs', () => {
    it('is the npm script `duplication:guard`, next to the two checks whose commands the witness replays, with no option on the command line', () => {
        const { scripts } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
        expect([scripts['duplication:guard'], scripts['duplication:tests'], scripts['duplication:production']]).toEqual([
            'node scripts/duplication-guard.mjs',
            'jscpd --config .jscpd.tests.json',
            'jscpd --config .jscpd.production.json'
        ]);
    });

    it('is a step of the CI that runs only that script, before both duplication checks', () => {
        const steps = readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8').split(/\n\s*- name:/).map((step) => step.split('\n').map((line) => line.trim()).filter((line) => line !== ''));
        const positionOf = (script: string) => steps.findIndex((lines) => lines.includes(`run: npm run ${script}`));
        expect(steps[positionOf('duplication:guard')]).toHaveLength(2);
        expect(positionOf('duplication:guard')).toBeGreaterThan(0);
        expect(positionOf('duplication:guard')).toBeLessThan(Math.min(positionOf('duplication:production'), positionOf('duplication:tests')));
    });
});

describe('this repository', () => {
    it('has no duplication check switched off: the guard passes in its root', () => {
        const run = guard(ROOT);
        expect([run.status, run.output]).toEqual([0, expect.stringContaining('No duplication check is switched off')]);
    });
});
