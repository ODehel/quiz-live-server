import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
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

describe('which files the branch changed', () => {
    it.each([
        ['a test', 'src/themes/a.test.ts'],
        ['an interface', 'src/themes/a.interface.ts'],
        ['a file of src/test-support', 'src/test-support/helper.mjs'],
        ['the composition entry point, whose tests start child processes', 'src/index.ts'],
        ['the seed entry point, whose tests start child processes', 'src/seed.ts'],
        ['a document', 'docs/decisions/DECISIONS.md']
    ])('does not run the mutation tool when the branch changes only %s', (_name, path) => {
        const repository = branchOf({ base: { [path]: SOURCE }, changes: { [path]: SOURCE + '// changed\n' } });
        const run = guard(repository, '--base', 'main');
        expect([run.status, strykerArguments(repository)]).toEqual([0, null]);
        expect(run.output).toContain('No production file changed');
    });
});
