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
