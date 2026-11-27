import { afterEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

// The production pass of knip (`npm run knip:production`) counts a file or an export as used only when production code reaches it:
// a test that alone imports an export no longer keeps it alive. This file proves it on throwaway trees and pins the script and the CI step
// that run it, so that an option removed or changed turns a test red.

const ROOT = resolve(__dirname, '..');

const KNIP = join(ROOT, 'node_modules/knip/bin/knip.js');
const manifest = () => JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
// The configuration is JSONC whose comments each take a line: stripping those lines leaves JSON.
type Configuration = { entry: string[]; project?: string[]; ignoreBinaries?: string[]; ignoreIssues?: Record<string, string[]> };
const CONFIGURATION = JSON.parse(readFileSync(join(ROOT, 'knip.production.jsonc'), 'utf8').split('\n').filter((line) => !line.trim().startsWith('//')).join('\n')) as Configuration;
const DORMANT = 'src/authentication/admission-policy.ts';

const trees: string[] = [];

afterEach(() => {
    for (const tree of trees.splice(0)) rmSync(tree, { recursive: true, force: true });
});

type Run = { status: number | null; output: string };

// Runs knip with the arguments of an npm script of the repository (`knip` or `knip:production`), in the given directory.
function runScript(script: string, cwd: string): Run {
    const [, ...args] = (manifest().scripts[script] ?? '').split(' ');
    const run = spawnSync(process.execPath, [KNIP, ...args], { cwd, encoding: 'utf8' });
    return { status: run.status, output: run.stdout + run.stderr };
}

// Writes a throwaway tree (with the real tsconfig.json) and runs the npm script in it.
function inTree(script: string, files: Record<string, string>): Run {
    const directory = mkdtempSync(join(tmpdir(), 'knip-'));
    trees.push(directory);
    copyFileSync(join(ROOT, 'tsconfig.json'), join(directory, 'tsconfig.json'));
    for (const [name, text] of Object.entries(files)) {
        mkdirSync(dirname(join(directory, name)), { recursive: true });
        writeFileSync(join(directory, name), text);
    }
    return runScript(script, directory);
}

// The production pass on a tree that holds the declared entries (each an empty module), a hub entry that starts with `tsx`, the files the case describes,
// and the real configuration (or the one the case changes).
function pass(files: Record<string, string>, changes: Partial<Configuration> = {}): Run {
    const entries = Object.fromEntries(CONFIGURATION.entry.map((entry) => [entry.replace(/!$/, ''), 'export {}\n']));
    return inTree('knip:production', {
        'package.json': JSON.stringify({ name: 'tree', scripts: { start: 'tsx src/index.ts' }, devDependencies: { tsx: '*', vitest: '*' } }),
        'knip.production.jsonc': JSON.stringify({ ...CONFIGURATION, ...changes }),
        'src/index.ts': "import { used } from './used'\nexport const hub = used\n",
        'src/used.ts': 'export const used = 1\n',
        ...entries,
        ...files
    });
}

// The full pass, as the npm script `knip` runs it, on a tree whose knip.jsonc declares one entry.
function fullPass(files: Record<string, string>): Run {
    return inTree('knip', { 'package.json': JSON.stringify({ name: 'tree' }), 'knip.jsonc': JSON.stringify({ entry: ['src/helper.mjs'] }), ...files });
}

const CI_STEPS = () => readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8').split(/\n\s*- name:/).map((step) => step.split('\n').map((line) => line.trim()).filter((line) => line !== ''));

describe('where the production pass runs', () => {
    it('is the npm script `knip:production`, next to `knip`, which turns a stale entry of knip.jsonc into a failure', () => {
        const { scripts } = manifest();
        expect([scripts.knip, scripts['knip:production']]).toEqual(['knip --treat-config-hints-as-errors', 'knip --production --config knip.production.jsonc']);
    });

    it('is a CI step that runs only that script, right after the pass over everything', () => {
        const steps = CI_STEPS();
        const positionOf = (script: string) => steps.findIndex((lines) => lines.includes(`run: npm run ${script}`));
        expect(steps[positionOf('knip:production')]).toHaveLength(2);
        expect(positionOf('knip:production')).toBe(positionOf('knip') + 1);
    });
});

const TESTED_ONLY = "import { onlyTested } from './lib'\nexport const used = onlyTested\n";

describe('production code that only its tests use', () => {
    it('passes on a tree where production reaches every export it declares', () => {
        const run = pass({});
        expect([run.status, run.output]).toEqual([0, '']);
    });

    it('fails on an export that only a test imports, and names it', () => {
        const run = pass({ 'src/lib.ts': 'export const onlyTested = 1\nexport const kept = 2\n', 'src/lib.test.ts': TESTED_ONLY, 'src/index.ts': "import { kept } from './lib'\nexport const hub = kept\n" });
        expect(run.status).toBe(1);
        expect(run.output).toContain('Unused exports (1)');
        expect(run.output).toMatch(/onlyTested\s+src\/lib\.ts/);
    });

    it('fails on a file that only a test imports', () => {
        const run = pass({ 'src/lib.ts': 'export const onlyTested = 1\n', 'src/lib.test.ts': TESTED_ONLY });
        expect([run.status, run.output]).toEqual([1, expect.stringContaining('src/lib.ts')]);
    });
});

describe('the files the configuration declares', () => {
    it.each(CONFIGURATION.entry.map((entry) => entry.replace(/!$/, '')))('fails when %s is no longer an entry', (entry) => {
        const run = pass({}, { entry: CONFIGURATION.entry.filter((declared) => declared !== `${entry}!`) });
        expect([run.status, run.output]).toEqual([1, expect.stringContaining(entry)]);
    });

    it('fails when `tsx`, which the start script runs, is no longer a known binary', () => {
        const run = pass({}, { ignoreBinaries: [] });
        expect([run.status, run.output]).toEqual([1, expect.stringContaining('tsx')]);
    });

    it('lets the files of src/test-support and docs/specs/scripts alone, which only tests and shell scripts run', () => {
        const run = pass({ 'src/test-support/helper.mjs': 'export const help = 1\n', 'docs/specs/scripts/generate.mjs': 'export const generate = 1\n' });
        expect([run.status, run.output]).toEqual([0, '']);
    });

    it('fails on those files once the project is no longer explicit', () => {
        const run = pass({ 'src/test-support/helper.mjs': 'export const help = 1\n' }, { project: undefined });
        expect([run.status, run.output]).toEqual([1, expect.stringContaining('src/test-support/helper.mjs')]);
    });
});

describe('the dormant admission policy', () => {
    const POLICY = { [DORMANT]: 'export class AdmissionPolicy {}\n', 'src/authentication/admission-policy.test.ts': "import { AdmissionPolicy } from './admission-policy'\nnew AdmissionPolicy()\n" };

    it('is set aside while only its test uses it', () => {
        const run = pass(POLICY);
        expect([run.status, run.output]).toEqual([0, '']);
    });

    it('fails once it is no longer set aside', () => {
        const run = pass(POLICY, { ignoreIssues: {} });
        expect([run.status, run.output]).toEqual([1, expect.stringContaining(DORMANT)]);
    });

    it('does not set aside another dormant file', () => {
        const run = pass({ 'src/other.ts': 'export class Other {}\n', 'src/other.test.ts': "import { Other } from './other'\nnew Other()\n" });
        expect([run.status, run.output]).toEqual([1, expect.stringContaining('src/other.ts')]);
    });
});

describe('an entry of knip.jsonc that no file matches', () => {
    it('passes while the file exists', () => {
        const run = fullPass({ 'src/helper.mjs': 'export {}\n' });
        expect([run.status, run.output]).toEqual([0, '']);
    });

    it('fails the full pass, as a configuration hint, once the file is gone', () => {
        const run = fullPass({});
        expect([run.status, run.output]).toEqual([1, expect.stringContaining('src/helper.mjs')]);
    });
});

describe('this repository', () => {
    it('has no production code that only its tests use: the production pass passes in its root', () => {
        const run = runScript('knip:production', ROOT);
        expect([run.status, run.output]).toEqual([0, '']);
    });
});
