import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, matchesGlob, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

// The mutation guard (`npm run mutation:changed`) is proved here on throwaway git repositories: each one holds the real
// configuration file and a fake Stryker that writes the report the case describes. The guard then reads the
// files the branch changed against its base, and a surviving mutant, a mutant without coverage or a comment that switches
// mutation off in one of them must fail the command.

const ROOT = resolve(__dirname, '..');
const SCRIPT = join(ROOT, 'scripts/mutation-guard.mjs');

const repositories: string[] = [];

afterEach(() => {
    for (const repository of repositories.splice(0)) rmSync(repository, { recursive: true, force: true });
});

function git(repository: string, ...args: string[]): string {
    return execFileSync('git', args, { cwd: repository, encoding: 'utf8' });
}

function write(repository: string, files: Record<string, string | null>): void {
    for (const [path, content] of Object.entries(files)) {
        if (content === null) rmSync(join(repository, path));
        else {
            mkdirSync(dirname(join(repository, path)), { recursive: true });
            writeFileSync(join(repository, path), content);
        }
    }
}

function commit(repository: string, files: Record<string, string | null>): void {
    write(repository, files);
    git(repository, 'add', '--all', '--', ...Object.keys(files));
    git(repository, '-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-q', '-m', 'change');
}

const FAKE_STRYKER = `
const { existsSync, readFileSync, mkdirSync, writeFileSync } = require('node:fs');
writeFileSync('stryker-arguments.json', JSON.stringify(process.argv.slice(2)));
const script = JSON.parse(readFileSync('fake-stryker.json', 'utf8'));
if (script.report !== null) {
    mkdirSync('reports/mutation', { recursive: true });
    writeFileSync('reports/mutation/mutation.json', JSON.stringify(script.report));
}
process.exit(script.exit);
`;

interface FakeMutant { mutatorName: string; status: string; replacement: string; line: number; statusReason?: string }

function reportOf(mutants: Record<string, FakeMutant[]>): unknown {
    const files = Object.fromEntries(Object.entries(mutants).map(([path, list]) => [path, {
        language: 'typescript',
        mutants: list.map(({ line, ...rest }, index) => ({ id: String(index), ...rest, location: { start: { line, column: 1 }, end: { line, column: 2 } } }))
    }]));
    return { schemaVersion: '1.0', files };
}

const KILLED: FakeMutant = { mutatorName: 'StringLiteral', status: 'Killed', replacement: '""', line: 1 };

interface Branch { base: Record<string, string>; changes: Record<string, string | null>; report?: unknown; strykerExit?: number }

function branchOf({ base, changes, report = null, strykerExit = 0 }: Branch): string {
    const repository = mkdtempSync(join(tmpdir(), 'mutation-guard-'));
    repositories.push(repository);
    git(repository, 'init', '-q', '-b', 'main');
    copyFileSync(join(ROOT, 'stryker.config.json'), join(repository, 'stryker.config.json'));
    write(repository, {
        'node_modules/@stryker-mutator/core/bin/stryker.js': FAKE_STRYKER,
        'fake-stryker.json': JSON.stringify({ report, exit: strykerExit })
    });
    commit(repository, base);
    git(repository, 'checkout', '-q', '-b', 'session');
    commit(repository, changes);
    return repository;
}

function guard(repository: string, ...args: string[]): { status: number | null; output: string } {
    const run = spawnSync(process.execPath, [SCRIPT, ...args], { cwd: repository, encoding: 'utf8' });
    return { status: run.status, output: run.stdout + run.stderr };
}

function strykerArguments(repository: string): string[] | null {
    const path = join(repository, 'stryker-arguments.json');
    return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as string[]) : null;
}

const SOURCE = 'export const value = 1\n';

const NOT_MUTATED: [string, string][] = [
    ['a test', 'src/themes/a.test.ts'],
    ['an interface', 'src/themes/a.interface.ts'],
    ['a file of src/test-support', 'src/test-support/helper.mjs'],
    ['the composition entry point, whose tests start child processes', 'src/index.ts'],
    ['the seed entry point, whose tests start child processes', 'src/seed.ts'],
    ['a document', 'docs/decisions/DECISIONS.md']
];

describe('which files the branch changed', () => {
    it.each(NOT_MUTATED)('does not run the mutation tool when the branch changes only %s', (_name, path) => {
        const repository = branchOf({ base: { [path]: SOURCE }, changes: { [path]: SOURCE + '// changed\n' } });
        const run = guard(repository, '--base', 'main');
        expect([run.status, strykerArguments(repository)]).toEqual([0, null]);
        expect(run.output).toContain('No production file changed');
    });
});

describe('what the mutation tool is asked to mutate', () => {
    it('is the production files the branch changed, and only them', () => {
        const repository = branchOf({
            base: { 'src/themes/a.ts': SOURCE, 'src/questions/b.ts': SOURCE, 'src/common/untouched.ts': SOURCE },
            changes: { 'src/themes/a.ts': SOURCE + '// changed\n', 'src/questions/b.ts': SOURCE + '// changed\n', 'src/questions/b.test.ts': SOURCE },
            report: reportOf({ 'src/themes/a.ts': [KILLED], 'src/questions/b.ts': [KILLED] })
        });
        const run = guard(repository, '--base', 'main');
        expect([run.status, strykerArguments(repository)]).toEqual([0, ['run', '--mutate', 'src/questions/b.ts,src/themes/a.ts']]);
        expect(run.output).toContain('No surviving mutant');
    });

    it('leaves out a production file the branch deleted', () => {
        const repository = branchOf({
            base: { 'src/themes/a.ts': SOURCE, 'src/themes/gone.ts': SOURCE },
            changes: { 'src/themes/a.ts': SOURCE + '// changed\n', 'src/themes/gone.ts': null },
            report: reportOf({ 'src/themes/a.ts': [KILLED] })
        });
        guard(repository, '--base', 'main');
        expect(strykerArguments(repository)).toEqual(['run', '--mutate', 'src/themes/a.ts']);
    });
});

const STATIC = 'Static mutant (and "ignoreStatic" was enabled)';

function branchWithMutants(mutants: FakeMutant[]): string {
    return branchOf({
        base: { 'src/themes/a.ts': SOURCE },
        changes: { 'src/themes/a.ts': SOURCE + '// changed\n' },
        report: reportOf({ 'src/themes/a.ts': [KILLED, ...mutants] })
    });
}

describe('which mutants fail the command', () => {
    it.each([
        ['survives', 'Survived'],
        ['is covered by no test', 'NoCoverage'],
        ['fails at run time', 'RuntimeError'],
        ['has a status the guard does not know', 'Pending']
    ])('fails when a mutant %s, and names it', (_name, status) => {
        const run = guard(branchWithMutants([{ mutatorName: 'EqualityOperator', status, replacement: 'a >= b', line: 7 }]), '--base', 'main');
        expect(run.status).toBe(1);
        expect(run.output).toContain(`src/themes/a.ts:7 ${status} EqualityOperator => a >= b`);
    });

    it.each([
        ['is killed', { status: 'Killed' }],
        ['times out, which counts as killed', { status: 'Timeout' }],
        ['does not compile', { status: 'CompileError' }],
        ['is static and the tool was asked to ignore the static ones', { status: 'Ignored', statusReason: STATIC }]
    ])('does not fail when a mutant %s', (_name, mutant) => {
        const run = guard(branchWithMutants([{ mutatorName: 'EqualityOperator', replacement: 'a >= b', line: 7, ...mutant }]), '--base', 'main');
        expect([run.status, run.output.includes('No surviving mutant')]).toEqual([0, true]);
    });

    it('fails when a mutant is ignored for any reason but being static', () => {
        const run = guard(branchWithMutants([{ mutatorName: 'EqualityOperator', status: 'Ignored', statusReason: 'Disabled by a comment', replacement: 'a >= b', line: 7 }]), '--base', 'main');
        expect(run.status).toBe(1);
        expect(run.output).toContain('src/themes/a.ts:7 Ignored EqualityOperator => a >= b');
    });

    it('lists every mutant that survives, in every changed file', () => {
        const repository = branchOf({
            base: { 'src/themes/a.ts': SOURCE, 'src/questions/b.ts': SOURCE },
            changes: { 'src/themes/a.ts': SOURCE + '// changed\n', 'src/questions/b.ts': SOURCE + '// changed\n' },
            report: reportOf({
                'src/themes/a.ts': [{ ...KILLED, status: 'Survived', line: 3 }],
                'src/questions/b.ts': [KILLED, { ...KILLED, status: 'NoCoverage', line: 5 }]
            })
        });
        const run = guard(repository, '--base', 'main');
        expect(run.output).toContain('src/themes/a.ts:3 Survived');
        expect(run.output).toContain('src/questions/b.ts:5 NoCoverage');
        expect(run.output).not.toContain('No surviving mutant');
    });
});

describe('what the guard cannot be talked out of', () => {
    it.each([
        ['a line comment that disables mutation', '// Stryker disable next-line all: equivalent'],
        ['a block comment that disables mutation', '/* Stryker disable all */'],
        ['a comment that restores mutation after a disable', '// Stryker restore all'],
        ['a comment in another case', '// stryker DISABLE-line StringLiteral'],
        ['a comment with the words apart', '//   Stryker    disable   next-line']
    ])('fails on %s in a changed file, without running the mutation tool', (_name, comment) => {
        const repository = branchOf({
            base: { 'src/themes/a.ts': SOURCE },
            changes: { 'src/themes/a.ts': `${SOURCE}${comment}\nexport const other = 2\n` },
            report: reportOf({ 'src/themes/a.ts': [KILLED] })
        });
        const run = guard(repository, '--base', 'main');
        expect([run.status, strykerArguments(repository)]).toEqual([1, null]);
        expect(run.output).toContain('src/themes/a.ts:2 switches mutation off');
    });

    it('does not read the comments of a file the branch does not change', () => {
        const repository = branchOf({
            base: { 'src/themes/a.ts': SOURCE, 'src/themes/old.ts': '// Stryker disable all\n' + SOURCE },
            changes: { 'src/themes/a.ts': SOURCE + '// changed\n' },
            report: reportOf({ 'src/themes/a.ts': [KILLED] })
        });
        expect(guard(repository, '--base', 'main').status).toBe(0);
    });

    it('fails when the mutation tool fails, even if a report says all is well', () => {
        const run = guard(branchOf({
            base: { 'src/themes/a.ts': SOURCE },
            changes: { 'src/themes/a.ts': SOURCE + '// changed\n' },
            report: reportOf({ 'src/themes/a.ts': [KILLED] }),
            strykerExit: 1
        }), '--base', 'main');
        expect(run.status).toBe(1);
        expect(run.output).toContain('The mutation tool failed');
    });

    it('fails when the mutation tool writes no report, and does not trust the one of an earlier run', () => {
        const repository = branchOf({ base: { 'src/themes/a.ts': SOURCE }, changes: { 'src/themes/a.ts': SOURCE + '// changed\n' } });
        write(repository, { 'reports/mutation/mutation.json': JSON.stringify(reportOf({ 'src/themes/a.ts': [KILLED] })) });
        const run = guard(repository, '--base', 'main');
        expect(run.status).toBe(1);
        expect(run.output).toContain('The mutation tool wrote no report');
    });

    it('fails when it is not told what to compare with', () => {
        const run = guard(branchOf({ base: { 'src/themes/a.ts': SOURCE }, changes: { 'src/themes/a.ts': SOURCE + '// changed\n' } }));
        expect(run.status).toBe(1);
        expect(run.output).toContain('Usage: mutation-guard --base <ref>');
    });

    it('fails when what it is told to compare with does not exist, instead of finding no change', () => {
        const run = guard(branchOf({ base: { 'src/themes/a.ts': SOURCE }, changes: { 'src/themes/a.ts': SOURCE + '// changed\n' } }), '--base', 'origin/nowhere');
        expect(run.status).toBe(1);
        expect(run.output).toContain('Cannot list the files changed since origin/nowhere');
    });
});

const CONFIGURATION = {
    $schema: './node_modules/@stryker-mutator/core/schema/stryker-schema.json',
    testRunner: 'vitest',
    checkers: ['typescript'],
    tsconfigFile: 'tsconfig.json',
    coverageAnalysis: 'perTest',
    ignoreStatic: true,
    mutate: ['src/**/*.ts', '!src/**/*.test.ts', '!src/**/*.interface.ts', '!src/test-support/**', '!src/index.ts', '!src/seed.ts'],
    reporters: ['json', 'clear-text'],
    jsonReporter: { fileName: 'reports/mutation/mutation.json' },
    clearTextReporter: { allowColor: false, logTests: false, reportScoreTable: true, skipFull: true },
    thresholds: { high: 100, low: 100, break: 100 },
    timeoutMS: 30000,
    concurrency: 2
};

function productionFilesOf(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) return entry.name === 'test-support' ? [] : productionFilesOf(path);
        return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [path] : [];
    });
}

describe('what the guard reads from the repository', () => {
    it('is the configuration of the mutation tool as decided: no threshold lowered, no ignorer, no option added or removed', () => {
        expect(JSON.parse(readFileSync(join(ROOT, 'stryker.config.json'), 'utf8'))).toEqual(CONFIGURATION);
    });

    it('has a case for every pattern that leaves a file out of the mutation', () => {
        const left = CONFIGURATION.mutate.filter((pattern) => pattern.startsWith('!')).map((pattern) => pattern.slice(1));
        const uncovered = left.filter((glob) => !NOT_MUTATED.some(([, path]) => matchesGlob(path, glob)));
        expect([uncovered, left.length]).toEqual([[], 5]);
    });

    it('finds no comment that switches mutation off in the production code', () => {
        const comments = productionFilesOf(join(ROOT, 'src')).filter((file) => /stryker\s+(disable|restore)/i.test(readFileSync(file, 'utf8')));
        expect(comments).toEqual([]);
    });
});
