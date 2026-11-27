import { afterEach, describe, expect, it } from 'vitest';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

// The complexity check (`npm run lint`, rule `complexity` of eslint.config.mjs) is proved here on throwaway trees: a function that is
// more complex than the threshold must fail the lint, and one at the threshold must pass. Each tree holds the real configuration and
// the real tsconfig.json, and is linted by the same CLI and the same arguments as the CI step, so a threshold raised or a rule emptied
// turns a test red.

const ROOT = resolve(__dirname, '..');
const CLI = join(ROOT, 'node_modules/eslint/bin/eslint.js');
const LINT_ARGUMENTS = () => (JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { scripts: Record<string, string> }).scripts.lint?.split(' ').slice(1) ?? [];

const trees: string[] = [];

afterEach(() => {
    for (const tree of trees.splice(0)) rmSync(tree, { recursive: true, force: true });
});

// A function whose cyclomatic complexity is exactly `complexity`: one path for the function, one more for each `if`.
function functionOfComplexity(complexity: number): string {
    const branches = Array.from({ length: complexity - 1 }, (_, index) => `    if (value === ${String(index)}) count++;\n`).join('');
    return `export function witness(value: number): number {\n    let count = 0;\n${branches}    return count;\n}\n`;
}

// Lints a tree that holds the real configuration, the real tsconfig.json and one file.
function lint(path: string, content: string): { status: number | null; output: string } {
    const tree = mkdtempSync(join(tmpdir(), 'complexity-guard-'));
    trees.push(tree);
    for (const name of ['eslint.config.mjs', 'tsconfig.json']) copyFileSync(join(ROOT, name), join(tree, name));
    symlinkSync(join(ROOT, 'node_modules'), join(tree, 'node_modules'));
    mkdirSync(dirname(join(tree, path)), { recursive: true });
    writeFileSync(join(tree, path), content);
    const run = spawnSync(process.execPath, [CLI, ...LINT_ARGUMENTS()], { cwd: tree, encoding: 'utf8' });
    return { status: run.status, output: run.stdout + run.stderr };
}

describe('the complexity of a function', () => {
    it.each(['src/witness.ts', 'src/witness.test.ts'])('fails the lint above 8, in %s, and names the function', (path) => {
        const run = lint(path, functionOfComplexity(9));
        expect(run.status).toBe(1);
        expect(run.output).toContain("Function 'witness' has a complexity of 9. Maximum allowed is 8");
    });

    it('lets a function of exactly 8 through', () => {
        const run = lint('src/witness.ts', functionOfComplexity(8));
        expect([run.status, run.output]).toEqual([0, '']);
    });
});
