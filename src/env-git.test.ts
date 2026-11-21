import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// US-002/CA-2 (« Format du fichier .env ») and « Sécurité » (« Le fichier .env doit figurer dans .gitignore »): the real file stays out of git, its
// versioned model stays in. Both are « spec tests »: they are born green (.gitignore is already right) and exist to keep it so; each was mutated
// before the commit (see the PR). They ask git itself, on the real repository, with `git check-ignore` and `git ls-files`: a copy of the rules would
// prove nothing. They are skipped, with the reason in the title, when `git` is absent or when the folder is not a git work tree, never faked green.
const ROOT = resolve(__dirname, '..')

function git(...args: string[]): { status: number | null; stdout: string; failedToStart: boolean } {
    const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' })
    return { status: result.status, stdout: result.stdout ?? '', failedToStart: result.error !== undefined }
}

const inside = git('rev-parse', '--is-inside-work-tree')
const NO_GIT_REPOSITORY = inside.failedToStart || inside.status !== 0 || inside.stdout.trim() !== 'true'

describe('the .env file and git (US-002/CA-2, spec tests)', () => {
    it.skipIf(NO_GIT_REPOSITORY)('US-002/CA-2 git ignores .env, so the real passwords cannot be committed (skipped without git or outside a git work tree)', () => {
        // `check-ignore --quiet`: exit code 0 = ignored, 1 = not ignored (a tracked file is reported as not ignored), 128 = error.
        expect(git('check-ignore', '--quiet', '.env').status).toBe(0)
    })

    it.skipIf(NO_GIT_REPOSITORY)('US-002/CA-2 git does not ignore .env.example and tracks it, so the versioned model stays in the repository (skipped without git or outside a git work tree)', () => {
        // --no-index judges the rules alone: without it git never reports a tracked file as ignored, and the rule could not fail here.
        expect(git('check-ignore', '--quiet', '--no-index', '.env.example').status).toBe(1)
        expect(git('ls-files', '--', '.env.example').stdout.split(/\r?\n/).filter(line => line !== '')).toEqual(['.env.example'])
    })
})
