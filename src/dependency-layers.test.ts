import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

// The layer check (`npm run layers`) is proved here on throwaway trees: every rule of .dependency-cruiser.cjs must fire on a
// file that breaks it, and stay silent on the imports it allows. Each tree is written under the temporary directory and cruised
// by the same CLI and the same configuration file as the CI step, so a rule removed, emptied, softened or mistyped turns a test red.

const ROOT = resolve(__dirname, '..');
const CLI = join(ROOT, 'node_modules/dependency-cruiser/bin/dependency-cruiser.mjs');
const CONFIGURATION = join(ROOT, '.dependency-cruiser.cjs');

interface Violation { rule: { name: string; severity: string }; from: string; to: string }
interface Report { summary: { violations: Violation[] } }

const trees: string[] = [];

afterEach(() => {
    for (const tree of trees.splice(0)) rmSync(tree, { recursive: true, force: true });
});

function writeTree(files: Record<string, string>): string {
    const tree = mkdtempSync(join(tmpdir(), 'dependency-layers-'));
    trees.push(tree);
    copyFileSync(join(ROOT, 'tsconfig.json'), join(tree, 'tsconfig.json'));
    for (const [path, content] of Object.entries(files)) {
        mkdirSync(dirname(join(tree, path)), { recursive: true });
        writeFileSync(join(tree, path), content);
    }
    return tree;
}

function cruise(tree: string, outputType: 'json' | 'err'): { status: number | null; stdout: string; stderr: string } {
    const run = spawnSync(process.execPath, [CLI, '--config', CONFIGURATION, '--output-type', outputType, 'src'], { cwd: tree, encoding: 'utf8' });
    return { status: run.status, stdout: run.stdout, stderr: run.stderr };
}

function violationsOf(files: Record<string, string>): string[] {
    const run = cruise(writeTree(files), 'json');
    if (run.status !== 0) throw new Error(`dependency-cruiser did not run (status ${String(run.status)}): ${run.stderr}${run.stdout}`);
    const report = JSON.parse(run.stdout) as Report;
    return report.summary.violations.map(({ rule, from, to }) => `${rule.severity} ${rule.name}: ${from} -> ${to}`).sort();
}

const LEAF = 'export const leaf = 1\n';
const TYPE_ONLY = (path: string) => `import type { T } from '${path}'\nexport type Copy = T\n`;
const VALUE = (path: string) => `import { leaf } from '${path}'\nexport const copy = leaf\n`;

interface Case { name: string; files: Record<string, string>; violations: string[] }

const layerCases: Case[] = [
    {
        name: 'common imports a feature, even through a type-only import that TypeScript erases',
        files: { 'src/common/a.ts': TYPE_ONLY('../themes/theme.interface'), 'src/themes/theme.interface.ts': 'export interface T {}\n' },
        violations: ['error common-imports-nothing-else: src/common/a.ts -> src/themes/theme.interface.ts']
    },
    {
        name: 'common imports infrastructure',
        files: { 'src/common/a.ts': VALUE('../infrastructure/leaf'), 'src/infrastructure/leaf.ts': LEAF },
        violations: ['error common-imports-nothing-else: src/common/a.ts -> src/infrastructure/leaf.ts']
    },
    {
        name: 'common imports common',
        files: { 'src/common/a.ts': VALUE('./leaf'), 'src/common/leaf.ts': LEAF },
        violations: []
    },
    {
        name: 'infrastructure imports a feature',
        files: { 'src/infrastructure/a.ts': VALUE('../users/leaf'), 'src/users/leaf.ts': LEAF },
        violations: ['error infrastructure-imports-only-common: src/infrastructure/a.ts -> src/users/leaf.ts']
    },
    {
        name: 'infrastructure imports common and infrastructure',
        files: {
            'src/infrastructure/a.ts': VALUE('../common/leaf') + VALUE('./leaf').replace('copy', 'second'),
            'src/common/leaf.ts': LEAF,
            'src/infrastructure/leaf.ts': LEAF
        },
        violations: []
    }
];

describe('layer rules', () => {
    it.each(layerCases)('$name', ({ files, violations }) => {
        expect(violationsOf(files)).toEqual(violations);
    });
});
