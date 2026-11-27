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
interface Report { summary: { violations: Violation[]; ruleSetUsed?: { forbidden?: { name: string; severity: string }[] } } }

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

function reportOf(files: Record<string, string>): Report {
    const run = cruise(writeTree(files), 'json');
    if (run.status !== 0) throw new Error(`dependency-cruiser did not run (status ${String(run.status)}): ${run.stderr}${run.stdout}`);
    return JSON.parse(run.stdout) as Report;
}

function violationsOf(files: Record<string, string>): string[] {
    return reportOf(files).summary.violations.map(({ rule, from, to }) => `${rule.severity} ${rule.name}: ${from} -> ${to}`).sort();
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
    ,
    {
        name: 'a production file imports a test',
        files: { 'src/themes/a.ts': VALUE('./b.test'), 'src/themes/b.test.ts': LEAF },
        violations: ['error production-does-not-import-test: src/themes/a.ts -> src/themes/b.test.ts']
    },
    {
        name: 'a production file imports a file of src/test-support',
        files: { 'src/themes/a.ts': VALUE('../test-support/helper.mjs'), 'src/test-support/helper.mjs': LEAF },
        violations: ['error production-does-not-import-test: src/themes/a.ts -> src/test-support/helper.mjs']
    },
    {
        name: 'a composition file imports a test',
        files: { 'src/index.ts': VALUE('./themes/a.test'), 'src/themes/a.test.ts': LEAF },
        violations: ['error production-does-not-import-test: src/index.ts -> src/themes/a.test.ts']
    },
    {
        name: 'a test imports a test and a file of src/test-support',
        files: {
            'src/themes/a.test.ts': VALUE('./b.test') + VALUE('../test-support/helper.mjs').replace('copy', 'second'),
            'src/themes/b.test.ts': LEAF,
            'src/test-support/helper.mjs': LEAF
        },
        violations: []
    },
    {
        name: 'two files import each other',
        files: { 'src/themes/a.ts': VALUE('./b') + 'export const leaf = 1\n', 'src/themes/b.ts': VALUE('./a') + 'export const leaf = 1\n' },
        violations: ['error no-circular: src/themes/a.ts -> src/themes/b.ts']
    },
    {
        name: 'two files import each other, one of them only through a type',
        files: {
            'src/themes/a.ts': "import type { T } from './b'\nexport const leaf = 1\nexport type U = T\n",
            'src/themes/b.ts': VALUE('./a') + 'export type T = 1\n'
        },
        violations: ['error no-circular: src/themes/a.ts -> src/themes/b.ts']
    },
    {
        name: 'two tests import each other',
        files: { 'src/themes/a.test.ts': VALUE('./b.test') + 'export const leaf = 1\n', 'src/themes/b.test.ts': VALUE('./a.test') + 'export const leaf = 1\n' },
        violations: ['error no-circular: src/themes/a.test.ts -> src/themes/b.test.ts']
    },
    {
        name: 'a file imports a file that does not exist',
        files: { 'src/themes/a.ts': VALUE('./does-not-exist') },
        violations: ['error not-to-unresolvable: src/themes/a.ts -> ./does-not-exist']
    },
    {
        name: 'a test imports a file that does not exist',
        files: { 'src/themes/a.test.ts': VALUE('../nowhere') },
        violations: ['error not-to-unresolvable: src/themes/a.test.ts -> ../nowhere']
    },
    {
        name: 'a file imports a module of Node',
        files: { 'src/themes/a.ts': "import { readFileSync } from 'node:fs'\nexport const read = readFileSync\n" },
        violations: []
    }
    ,
    {
        name: 'a file of a directory that is no known layer imports common',
        files: { 'src/mystery/a.ts': VALUE('../common/leaf'), 'src/common/leaf.ts': LEAF },
        violations: ['error file-outside-every-layer-imports: src/mystery/a.ts -> src/common/leaf.ts']
    },
    {
        name: 'a file at the root of src that is not the composition imports common',
        files: { 'src/helper.ts': VALUE('./common/leaf'), 'src/common/leaf.ts': LEAF },
        violations: ['error file-outside-every-layer-imports: src/helper.ts -> src/common/leaf.ts']
    },
    {
        name: 'a feature imports a file of a directory that is no known layer',
        files: { 'src/themes/a.ts': VALUE('../mystery/leaf'), 'src/mystery/leaf.ts': LEAF },
        violations: ['error import-of-a-file-outside-every-layer: src/themes/a.ts -> src/mystery/leaf.ts']
    },
    {
        name: 'two files of a directory that is no known layer import each other',
        files: { 'src/mystery/a.ts': VALUE('./leaf'), 'src/mystery/leaf.ts': LEAF },
        violations: [
            'error file-outside-every-layer-imports: src/mystery/a.ts -> src/mystery/leaf.ts',
            'error import-of-a-file-outside-every-layer: src/mystery/a.ts -> src/mystery/leaf.ts'
        ]
    },
    {
        name: 'a test in a directory that is no known layer imports common',
        files: { 'src/mystery/a.test.ts': VALUE('../common/leaf'), 'src/common/leaf.ts': LEAF },
        violations: []
    }
];

describe('layer rules', () => {
    it.each(layerCases)('$name', ({ files, violations }) => {
        expect(violationsOf(files)).toEqual(violations);
    });
});

const WITNESS_LEAF = { 'src/themes/leaf.ts': LEAF };
const crossesFromCommon = (file: string) => `error common-imports-nothing-else: src/common/${file} -> src/themes/leaf.ts`;

describe('what the check cannot be talked out of', () => {
    it('is not hidden by a comment that disables another check or this one', () => {
        expect(violationsOf({
            ...WITNESS_LEAF,
            'src/common/a.ts': '// eslint-disable-next-line\n// @ts-ignore\n' + VALUE('../themes/leaf'),
            'src/common/b.ts': '/* eslint-disable */\n/* dependency-cruiser ignore */\n' + VALUE('../themes/leaf'),
            'src/common/c.ts': '// depcruise-ignore\n// dependency-cruiser-ignore\n// @ts-nocheck\n// jscpd:ignore-start\n' + VALUE('../themes/leaf')
        })).toEqual([crossesFromCommon('a.ts'), crossesFromCommon('b.ts'), crossesFromCommon('c.ts')]);
    });

    it('sees every written form of an import', () => {
        expect(violationsOf({
            ...WITNESS_LEAF,
            'src/common/a.ts': "export const load = () => import('../themes/leaf')\n",
            'src/common/b.ts': "export const loaded = require('../themes/leaf')\n",
            'src/common/c.ts': "export { leaf } from '../themes/leaf'\n",
            'src/common/d.ts': "import '../themes/leaf'\n",
            'src/common/e.ts': "export type Leaf = typeof import('../themes/leaf')\n"
        })).toEqual(['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts'].map(crossesFromCommon));
    });

    it('fails the command when a layer is crossed, and succeeds when none is', () => {
        const crossing = cruise(writeTree({ ...WITNESS_LEAF, 'src/common/a.ts': VALUE('../themes/leaf') }), 'err');
        const clean = cruise(writeTree({ ...WITNESS_LEAF, 'src/themes/a.ts': VALUE('./leaf') }), 'err');
        expect([crossing.status === 0, clean.status]).toEqual([false, 0]);
    });

    it('has no rule that no case above fires', () => {
        const rules = (reportOf({ 'src/themes/leaf.ts': LEAF }).summary.ruleSetUsed?.forbidden ?? []).map(({ name }) => name).sort();
        const fired = new Set(layerCases.flatMap(({ violations }) => violations.map((violation) => violation.replace(/^error ([^:]+):.*$/, '$1'))));
        expect(rules.filter((name) => !fired.has(name))).toEqual([]);
        expect(rules.length).toBeGreaterThan(0);
    });
});
