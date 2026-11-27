import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

// The duplication guard (`npm run duplication:guard`) is proved here on throwaway trees: each one holds the real configuration
// and baseline of the test check, and the files the case describes. The guard reads the tree it is run in and must fail the command
// when a comment switches a duplication check off in `src`, or when the test check no longer fails on a new duplicated block.

const ROOT = resolve(__dirname, '..');
const SCRIPT = join(ROOT, 'scripts/duplication-guard.mjs');
const CONFIGURATION = readFileSync(join(ROOT, '.jscpd.tests.json'), 'utf8');
const BASELINE = readFileSync(join(ROOT, '.jscpd.tests.baseline.json'), 'utf8');
// Built at run time: the guard reads this very file, and jscpd honours the marker even inside a string.
const marker = (kind: string) => ['jscpd', `ignore-${kind}`].join(':');
const MARKER = marker('start');

const trees: string[] = [];

afterEach(() => {
    for (const tree of trees.splice(0)) rmSync(tree, { recursive: true, force: true });
});

function treeOf(files: Record<string, string>, configuration = CONFIGURATION): string {
    const tree = mkdtempSync(join(tmpdir(), 'duplication-guard-'));
    trees.push(tree);
    for (const [path, content] of Object.entries({ '.jscpd.tests.json': configuration, '.jscpd.tests.baseline.json': BASELINE, ...files })) {
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

describe('where the guard runs', () => {
    it('is the npm script `duplication:guard`, next to the check of the tests whose command the witness replays', () => {
        const { scripts } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
        expect([scripts['duplication:guard'], scripts['duplication:tests']]).toEqual(['node scripts/duplication-guard.mjs', 'jscpd --config .jscpd.tests.json']);
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
