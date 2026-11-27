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
    ,
    {
        name: 'a feature imports the composition root',
        files: { 'src/themes/a.ts': VALUE('../quiz-server'), 'src/quiz-server.ts': LEAF },
        violations: ['error only-composition-imports-composition: src/themes/a.ts -> src/quiz-server.ts']
    },
    {
        name: 'a feature imports the composition configuration interface',
        files: { 'src/users/a.ts': TYPE_ONLY('../quiz-server-configuration.interface'), 'src/quiz-server-configuration.interface.ts': 'export interface T {}\n' },
        violations: ['error only-composition-imports-composition: src/users/a.ts -> src/quiz-server-configuration.interface.ts']
    },
    {
        name: 'the composition files import every layer and each other',
        files: {
            'src/index.ts': VALUE('./quiz-server') + VALUE('./infrastructure/leaf').replace('copy', 'second') + VALUE('./themes/leaf').replace('copy', 'third'),
            'src/seed.ts': VALUE('./common/leaf'),
            'src/quiz-server.ts': VALUE('./questions/leaf'),
            'src/infrastructure/leaf.ts': LEAF,
            'src/themes/leaf.ts': LEAF,
            'src/common/leaf.ts': LEAF,
            'src/questions/leaf.ts': LEAF
        },
        violations: []
    },
    {
        name: 'a feature imports infrastructure',
        files: { 'src/themes/a.ts': VALUE('../infrastructure/leaf'), 'src/infrastructure/leaf.ts': LEAF },
        violations: ['error feature-does-not-import-infrastructure: src/themes/a.ts -> src/infrastructure/leaf.ts']
    },
    {
        name: 'a route of src/routes imports infrastructure',
        files: { 'src/routes/health-route.ts': VALUE('../infrastructure/leaf'), 'src/infrastructure/leaf.ts': LEAF },
        violations: ['error feature-does-not-import-infrastructure: src/routes/health-route.ts -> src/infrastructure/leaf.ts']
    },
    {
        name: 'a feature imports common',
        files: { 'src/themes/a.ts': VALUE('../common/leaf'), 'src/common/leaf.ts': LEAF },
        violations: []
    },
    {
        name: 'tests import the composition root and infrastructure (they wire real adapters)',
        files: {
            'src/themes/a.test.ts': VALUE('../quiz-server') + VALUE('../infrastructure/leaf').replace('copy', 'second'),
            'src/quiz-server.ts': LEAF,
            'src/infrastructure/leaf.ts': LEAF
        },
        violations: []
    }
    ,
    {
        name: 'a route imports a sqlite repository',
        files: { 'src/questions/question-route.ts': VALUE('./sqlite-question-repository'), 'src/questions/sqlite-question-repository.ts': LEAF },
        violations: ['error route-or-service-does-not-import-sqlite: src/questions/question-route.ts -> src/questions/sqlite-question-repository.ts']
    },
    {
        name: 'a default service imports a sqlite repository',
        files: { 'src/themes/default-theme-service.ts': VALUE('./sqlite-theme-repository'), 'src/themes/sqlite-theme-repository.ts': LEAF },
        violations: ['error route-or-service-does-not-import-sqlite: src/themes/default-theme-service.ts -> src/themes/sqlite-theme-repository.ts']
    },
    {
        name: 'a service not named default-* imports a sqlite repository',
        files: { 'src/authentication/jwt-authentication-service.ts': VALUE('./sqlite-user-repository'), 'src/authentication/sqlite-user-repository.ts': LEAF },
        violations: ['error route-or-service-does-not-import-sqlite: src/authentication/jwt-authentication-service.ts -> src/authentication/sqlite-user-repository.ts']
    },
    {
        name: 'a file that is neither a route nor a service imports a sqlite repository of its feature',
        files: { 'src/questions/existence-checker.ts': VALUE('./sqlite-question-repository'), 'src/questions/sqlite-question-repository.ts': LEAF },
        violations: []
    },
    {
        name: 'a route imports a default service',
        files: { 'src/themes/theme-route.ts': VALUE('./default-theme-service'), 'src/themes/default-theme-service.ts': LEAF },
        violations: ['error route-does-not-import-concrete-service: src/themes/theme-route.ts -> src/themes/default-theme-service.ts']
    },
    {
        name: 'a route imports a service not named default-*',
        files: { 'src/authentication/token-route.ts': VALUE('./jwt-authentication-service'), 'src/authentication/jwt-authentication-service.ts': LEAF },
        violations: ['error route-does-not-import-concrete-service: src/authentication/token-route.ts -> src/authentication/jwt-authentication-service.ts']
    },
    {
        name: 'a route imports the interface of its service',
        files: { 'src/themes/theme-route.ts': TYPE_ONLY('./theme-service.interface'), 'src/themes/theme-service.interface.ts': 'export interface T {}\n' },
        violations: []
    },
    {
        name: 'a service imports a route',
        files: { 'src/themes/default-theme-service.ts': VALUE('./theme-route'), 'src/themes/theme-route.ts': LEAF },
        violations: ['error service-does-not-import-route: src/themes/default-theme-service.ts -> src/themes/theme-route.ts']
    },
    {
        name: 'a service imports the configuration interface of a route',
        files: { 'src/themes/default-theme-service.ts': TYPE_ONLY('./theme-route-configuration.interface'), 'src/themes/theme-route-configuration.interface.ts': 'export interface T {}\n' },
        violations: ['error service-does-not-import-route: src/themes/default-theme-service.ts -> src/themes/theme-route-configuration.interface.ts']
    },
    {
        name: 'a service imports a file of src/routes',
        files: { 'src/themes/default-theme-service.ts': VALUE('../routes/route-catalog'), 'src/routes/route-catalog.ts': LEAF },
        violations: ['error service-does-not-import-route: src/themes/default-theme-service.ts -> src/routes/route-catalog.ts']
    },
    {
        name: 'a feature imports the sqlite repository of another feature',
        files: { 'src/themes/a.ts': VALUE('../questions/sqlite-question-repository'), 'src/questions/sqlite-question-repository.ts': LEAF },
        violations: ['error feature-does-not-import-concrete-of-another-feature: src/themes/a.ts -> src/questions/sqlite-question-repository.ts']
    },
    {
        name: 'a feature imports the default service of another feature',
        files: { 'src/themes/a.ts': VALUE('../questions/default-question-service'), 'src/questions/default-question-service.ts': LEAF },
        violations: ['error feature-does-not-import-concrete-of-another-feature: src/themes/a.ts -> src/questions/default-question-service.ts']
    },
    {
        name: 'a feature imports the route of another feature',
        files: { 'src/themes/a.ts': VALUE('../questions/question-route'), 'src/questions/question-route.ts': LEAF },
        violations: ['error feature-does-not-import-concrete-of-another-feature: src/themes/a.ts -> src/questions/question-route.ts']
    },
    {
        name: 'a feature imports the service that is not named default-* of another feature',
        files: { 'src/websocket/a.ts': VALUE('../authentication/jwt-authentication-service'), 'src/authentication/jwt-authentication-service.ts': LEAF },
        violations: ['error feature-does-not-import-concrete-of-another-feature: src/websocket/a.ts -> src/authentication/jwt-authentication-service.ts']
    },
    {
        name: 'a feature imports interfaces and plain modules of another feature',
        files: {
            'src/themes/a.ts': TYPE_ONLY('../questions/question-service.interface') + VALUE('../users/role-label').replace('copy', 'second'),
            'src/questions/question-service.interface.ts': 'export interface T {}\n',
            'src/users/role-label.ts': LEAF
        },
        violations: []
    },
    {
        name: 'tests import concrete files of another feature and of their own feature',
        files: {
            'src/questions/a.test.ts': VALUE('../themes/sqlite-theme-repository') + VALUE('./sqlite-question-repository').replace('copy', 'second'),
            'src/themes/theme-route.test.ts': VALUE('./sqlite-theme-repository'),
            'src/themes/sqlite-theme-repository.ts': LEAF,
            'src/questions/sqlite-question-repository.ts': LEAF
        },
        violations: []
    }
];

describe('layer rules', () => {
    it.each(layerCases)('$name', ({ files, violations }) => {
        expect(violationsOf(files)).toEqual(violations);
    });
});
