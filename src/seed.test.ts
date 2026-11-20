import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import bcrypt from 'bcryptjs'
import Database from 'better-sqlite3'
import { SqliteQuestionRepository } from './questions/sqlite-question-repository'
import { SqliteThemeRepository } from './themes/sqlite-theme-repository'
import { SqliteUserRepository } from './users/sqlite-user-repository'
import { UserRole } from './users/user-role'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

// `npm run seed` runs `tsx src/seed.ts`: these tests run the same entry point in a child process
// and observe it from outside (exit code, outputs, files). The rules on the path are proved by
// read-database-path.test.ts; here we prove that seed.ts applies them, in the order of US-002.
const TSX_CLI = resolve(__dirname, '../node_modules/tsx/dist/cli.mjs')
const SEED = resolve(__dirname, 'seed.ts')
const TEST_TIMEOUT_MS = 30_000
const REFUSAL = 'User seeding failed: SQLITE_DB_PATH cannot be empty or made only of whitespace.'
const FAILURE = /^User seeding failed: \S/
const STACK_TRACE = /\n\s+at /
const TEXT = 'this is a text file, not a SQLite database'

let workDirectory: string

beforeEach(() => {
    workDirectory = mkdtempSync(join(tmpdir(), 'quiz-seed-'))
})

afterEach(() => {
    restorePermissions(workDirectory)
    rmSync(workDirectory, { recursive: true, force: true, maxRetries: 5 })
})

// A test may leave a read-only file or directory behind: a directory without write permission cannot be emptied, so every
// permission is given back before the removal (a no-op for what the tests never restricted).
function restorePermissions(path: string): void {
    try {
        const isDirectory = statSync(path).isDirectory()
        chmodSync(path, isDirectory ? 0o755 : 0o644)
        if (isDirectory) readdirSync(path).forEach(name => restorePermissions(join(path, name)))
    } catch { /* already gone, or not ours to change: the removal reports what matters */ }
}

// The environment is explicit, so that the result depends neither on a .env nor on the machine.
// The working directory is the temporary one, so that no .env of the repository is read either.
// Node 26 prints the DEP0205 deprecation warning of tsx (module.register()) on the error output: it is silenced by its code,
// so that the outputs of a successful seed can still be required to be empty, whatever the version of Node.
const SILENCE_TSX_DEPRECATION = '--disable-warning=DEP0205'

function validEnvironment(): Record<string, string> {
    const environment: Record<string, string> = { SEED_PASSWORD_ADMIN: 'an-admin-password-1', BCRYPT_COST: '4' }
    for (let i = 1; i <= 10; i++) {
        environment[`SEED_PASSWORD_BUZZER_${String(i).padStart(2, '0')}`] = `a-buzzer-password-${i}`
    }
    return environment
}

// An override set to undefined removes the variable from the environment of the child process (a databasePath of undefined removes SQLITE_DB_PATH: only a .env file can then write it).
function seed(databasePath: string | undefined, overrides: Record<string, string | undefined> = {}) {
    const result = spawnSync(process.execPath, [TSX_CLI, SEED], {
        cwd: workDirectory,
        env: { ...validEnvironment(), NODE_OPTIONS: SILENCE_TSX_DEPRECATION, SQLITE_DB_PATH: databasePath, ...overrides },
        encoding: 'utf8',
        timeout: TEST_TIMEOUT_MS
    })
    return { status: result.status, stdout: result.stdout, stderr: result.stderr }
}

// US-002/CA-1 and decision #73: only the sense of the success line is normative (the eleven accounts were created); its wording is not
// (neither the language, nor the figure, nor the punctuation). So the form is fixed: exactly one non-empty line, on the standard output,
// nothing on the error output, exit code 0, not a failure message. Its sense is fixed as far as it can be without a word of it:
// it is a line of its own, neither silence nor the line of a skipped seed (CA-7), which is proved against a second run below.
function expectCreatedSeed(result: { status: number | null; stdout: string; stderr: string }): string {
    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')
    const lines = result.stdout.split('\n').filter(line => line.trim() !== '')
    expect(lines).toHaveLength(1)
    expect(result.stdout).toBe(lines.join('') + '\n')
    expect(lines.join('')).not.toMatch(FAILURE)
    return lines.join('')
}

// US-002/CA-7 and decision #66: only the sense of the line is normative (no account created, because the table is not empty);
// its wording is not. So the tests fix the form (exactly one non-empty line, on the standard output, nothing on the error output,
// exit code 0), that it is neither the silence of a first run nor a failure message, and that it is the same line whatever
// the environment (one condition produces it). They never fix a word of it, nor the name of the table.
function expectSkippedSeed(result: { status: number | null; stdout: string; stderr: string }): string {
    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')
    const lines = result.stdout.split('\n').filter(line => line.trim() !== '')
    expect(lines).toHaveLength(1)
    expect(result.stdout).toBe(lines.join('') + '\n')
    expect(lines.join('')).not.toMatch(FAILURE)
    return lines.join('')
}

function countAccounts(databasePath: string): number {
    const database = new Database(databasePath, { readonly: true })
    try {
        return (database.prepare('SELECT COUNT(*) AS count FROM T_USER_USR').get() as { count: number }).count
    } finally {
        database.close()
    }
}

// The closed list of the 25 whitespace characters of US-001/CA-10 (decision #61), by code point.
const WHITESPACE_CODE_POINTS = [0x0009, 0x000A, 0x000B, 0x000C, 0x000D, 0x0020, 0x00A0, 0x1680, ...Array.from({ length: 11 }, (_, i) => 0x2000 + i), 0x2028, 0x2029, 0x202F, 0x205F, 0x3000, 0xFEFF]
const codePoint = (character: string): string => 'U+' + character.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')
// Every blank alone, plus the empty string and two values made of several blanks.
const BLANK_PATHS: Array<[string, string]> = [
    ['an empty string', ''],
    ...WHITESPACE_CODE_POINTS.map((point): [string, string] => [codePoint(String.fromCodePoint(point)), String.fromCodePoint(point)]),
    ['three spaces', '   '],
    ['a mix of blanks', ' \t\r\n']
]
// Not whitespace for the rule, although invisible: alone, each one is a one-character path (decision #61).
const NOT_BLANK_CHARACTERS: Array<[string, string]> = [
    ['U+200B', '\u200B'],
    ['U+0085', '\u0085'],
    ['U+180E', '\u180E']
]

// Beyond U+3100 (decision #61): none of these is in the closed list of 25 blanks, so each one alone is a one-character path.
// U+3101 is the first character above U+3100, U+FF21 a full-width letter (Basic Multilingual Plane), U+1F600 a character outside
// the BMP (two UTF-16 code units). Which characters are sampled is an implementation choice, not an observable behaviour.
const BEYOND_U3100_CHARACTERS: Array<[string, string]> = [
    ['U+3101', '\u3101'],
    ['U+FF21', '\uFF21'],
    ['U+1F600', '\u{1F600}']
]
// A file system that cannot hold a name cannot prove the test: it is skipped explicitly (title and skipIf), never faked.
function filesystemKeepsTheName(character: string): boolean {
    const probeDirectory = mkdtempSync(join(tmpdir(), 'quiz-name-probe-'))
    try {
        writeFileSync(join(probeDirectory, character), '')
        const names = readdirSync(probeDirectory)
        return names.length === 1 && names[0] === character
    } catch {
        return false
    } finally {
        rmSync(probeDirectory, { recursive: true, force: true })
    }
}

describe('seed: SQLITE_DB_PATH', () => {
    it.each(BLANK_PATHS)('US-002/CA-8 refuses to run when SQLITE_DB_PATH is %s: exit code 1, the message on the error output, nothing created', (_name, blankPath) => {
        const result = seed(blankPath)

        expect(result.status).toBe(1)
        expect(result.stderr).toContain(REFUSAL)
        expect(result.stdout).toBe('')
        expect(readdirSync(workDirectory)).toEqual([])
    }, TEST_TIMEOUT_MS)

    it.each(NOT_BLANK_CHARACTERS)('US-002/CA-8 does not refuse %s alone: exit code 0, the success line, a file named by this one character holds the accounts', (_name, character) => {
        const result = seed(character)

        expectCreatedSeed(result)
        expect(readdirSync(workDirectory)).toEqual([character])
        expect(countAccounts(join(workDirectory, character))).toBe(11)
    }, TEST_TIMEOUT_MS)

    for (const [name, character] of BEYOND_U3100_CHARACTERS) {
        it.skipIf(!filesystemKeepsTheName(character))('US-002/CA-8 does not refuse ' + name + ' alone, beyond U+3100: exit code 0, the success line, a file named by this one character holds the accounts (skipped when the file system cannot hold this name)', () => {
            const result = seed(character)

            expectCreatedSeed(result)
            expect(readdirSync(workDirectory)).toEqual([character])
            expect(countAccounts(join(workDirectory, character))).toBe(11)
        }, TEST_TIMEOUT_MS)
    }

    it('US-002/CA-8 does not repeat the blank value in the message', () => {
        const result = seed('\t\t\t')

        expect(result.stderr).not.toContain('\t')
    }, TEST_TIMEOUT_MS)

    it('US-002/CA-8 reports only the SQLITE_DB_PATH error when a password and BCRYPT_COST are wrong too', () => {
        const result = seed(' ', { SEED_PASSWORD_ADMIN: 'short', BCRYPT_COST: 'abc' })

        expect(result.status).toBe(1)
        expect(result.stderr).toContain(REFUSAL)
        expect(result.stderr).not.toContain('Invalid password')
        expect(result.stderr).not.toContain('BCRYPT_COST')
        expect(readdirSync(workDirectory)).toEqual([])
    }, TEST_TIMEOUT_MS)

    it('US-002/CA-8 does not refuse :memory:, bordered or not: exit code 0, the success line, no file created', () => {
        const result = seed(' :memory: ')

        expectCreatedSeed(result)
        expect(readdirSync(workDirectory)).toEqual([])
    }, TEST_TIMEOUT_MS)

    it('US-002/CA-8 uses the path without the whitespace around it', () => {
        const databasePath = join(workDirectory, 'bordered.db')

        const result = seed('\t\u3000' + databasePath + '\uFEFF \r\n')

        expectCreatedSeed(result)
        expect(readdirSync(workDirectory)).toEqual(['bordered.db'])
        expect(countAccounts(databasePath)).toBe(11)
    }, TEST_TIMEOUT_MS)
})

describe('seed: unusable database', () => {
    // 200 bytes of arbitrary binary content, reproducible: a PRNG (mulberry32) with a constant seed, never crypto.randomBytes (an unstable test).
    function randomBytes(length: number): Buffer {
        let state = 0x5EED
        const bytes = Buffer.alloc(length)
        for (let i = 0; i < length; i++) {
            state = (state + 0x6D2B79F5) | 0
            let t = Math.imul(state ^ (state >>> 15), 1 | state)
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
            bytes[i] = ((t ^ (t >>> 14)) >>> 0) & 0xFF
        }
        return bytes
    }
    const RANDOM_BYTES = randomBytes(200)

    function unusableDatabase(kind: 'missing directory' | 'directory' | 'text file' | '200 random bytes'): string {
        if (kind === 'missing directory') return join(workDirectory, 'missing-directory', 'seed.db')
        if (kind === 'directory') {
            const directory = join(workDirectory, 'a-directory')
            mkdirSync(directory)
            return directory
        }
        if (kind === '200 random bytes') {
            const binaryFile = join(workDirectory, 'random.db')
            writeFileSync(binaryFile, RANDOM_BYTES)
            return binaryFile
        }
        const textFile = join(workDirectory, 'notes.db')
        writeFileSync(textFile, TEXT)
        return textFile
    }

    it('US-002/CA-9 uses 200 random bytes that are neither all zero nor the header of a SQLite database', () => {
        expect(RANDOM_BYTES).toHaveLength(200)
        expect(RANDOM_BYTES.some(byte => byte !== 0)).toBe(true)
        expect(RANDOM_BYTES.subarray(0, 16).equals(Buffer.from('SQLite format 3\0', 'latin1'))).toBe(false)
        expect(RANDOM_BYTES.includes(0)).toBe(true)
        expect(RANDOM_BYTES.some(byte => byte < 0x20 && ![0x09, 0x0A, 0x0D].includes(byte))).toBe(true)
    })

    it.each(['missing directory', 'directory', 'text file', '200 random bytes'] as const)('US-002/CA-9 refuses to run on a %s: exit code 1, the cause on the error output, no stack trace', (kind) => {
        const result = seed(unusableDatabase(kind))

        expect(result.status).toBe(1)
        expect(result.stderr).toMatch(FAILURE)
        expect(result.stderr).not.toMatch(STACK_TRACE)
        expect(result.stdout).toBe('')
    }, TEST_TIMEOUT_MS)

    it.each(['missing directory', 'directory', 'text file', '200 random bytes'] as const)('US-002/CA-9 reports only the database error on a %s when a password and BCRYPT_COST are wrong too', (kind) => {
        const result = seed(unusableDatabase(kind), { SEED_PASSWORD_ADMIN: 'short', BCRYPT_COST: 'abc' })

        expect(result.status).toBe(1)
        expect(result.stderr).toMatch(FAILURE)
        expect(result.stderr).not.toContain('Invalid password')
        expect(result.stderr).not.toContain('BCRYPT_COST')
    }, TEST_TIMEOUT_MS)

    it('US-002/CA-9 leaves a file that is not a SQLite database untouched', () => {
        const textFile = unusableDatabase('text file')

        seed(textFile)

        expect(readFileSync(textFile, 'utf8')).toBe(TEXT)
    }, TEST_TIMEOUT_MS)

    it('US-002/CA-9 leaves a file of 200 random bytes untouched, byte for byte', () => {
        const binaryFile = unusableDatabase('200 random bytes')

        seed(binaryFile)

        expect(readFileSync(binaryFile).equals(RANDOM_BYTES)).toBe(true)
        expect(readdirSync(workDirectory)).toEqual(['random.db'])
    }, TEST_TIMEOUT_MS)

    it('US-002/CA-9 still seeds a database file that does not exist yet, in an existing directory', () => {
        const databasePath = join(workDirectory, 'new.db')

        const result = seed(databasePath)

        expectCreatedSeed(result)
        expect(countAccounts(databasePath)).toBe(11)
    }, TEST_TIMEOUT_MS)

    it('US-002/CA-9 still seeds an existing database file of zero bytes', () => {
        const emptyFile = join(workDirectory, 'empty.db')
        writeFileSync(emptyFile, '')

        const result = seed(emptyFile)

        expectCreatedSeed(result)
        expect(countAccounts(emptyFile)).toBe(11)
    }, TEST_TIMEOUT_MS)
})

// Rows of every table of a database file, by table name.
function rowCounts(databasePath: string): Record<string, number> {
    const database = new Database(databasePath, { readonly: true })
    try {
        const names = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[]
        return Object.fromEntries(names.map(({ name }) => [name, (database.prepare(`SELECT COUNT(*) AS count FROM ${name}`).get() as { count: number }).count]))
    } finally {
        database.close()
    }
}

describe('seed: database file left behind by a refusal', () => {
    const REFUSALS = [
        ['a password that is too short', { SEED_PASSWORD_ADMIN: 'short' }],
        ['a BCRYPT_COST that is invalid', { BCRYPT_COST: 'abc' }]
    ] as const
    const STARTS = ['absent', 'zero bytes'] as const

    function databaseFile(start: typeof STARTS[number]): string {
        const databasePath = join(workDirectory, 'left.db')
        if (start === 'zero bytes') writeFileSync(databasePath, '')
        return databasePath
    }

    describe.each(REFUSALS)('with %s', (_label, overrides) => {
        it.each(STARTS)('US-002/CA-9 keeps the database file, with an empty user table, when it was %s', (start) => {
            const databasePath = databaseFile(start)

            const result = seed(databasePath, overrides)

            expect(result.status).toBe(1)
            expect(result.stderr).toMatch(FAILURE)
            expect(rowCounts(databasePath)).toEqual({ T_USER_USR: 0 })
        }, TEST_TIMEOUT_MS)

        it('US-002/CA-9 does not touch a database that already exists and has an empty user table', () => {
            const databasePath = databaseFile('absent')
            seed(databasePath, overrides)
            const before = readFileSync(databasePath)

            const result = seed(databasePath, overrides)

            expect(result.status).toBe(1)
            expect(readFileSync(databasePath).equals(before)).toBe(true)
        }, TEST_TIMEOUT_MS)

        it('US-002/CA-1 creates the eleven accounts on the next run, once the cause is corrected', () => {
            const databasePath = databaseFile('absent')
            seed(databasePath, overrides)

            const result = seed(databasePath)

            expectCreatedSeed(result)
            expect(countAccounts(databasePath)).toBe(11)
        }, TEST_TIMEOUT_MS)
    })
})

// Every account of a database file, with its stored hash, in a stable order.
function accounts(databasePath: string): Array<{ id: string; login: string; hash: string; role: string }> {
    const database = new Database(databasePath, { readonly: true })
    try {
        return database.prepare('SELECT USR_ID AS id, USR_LOGIN AS login, USR_HASH_PASSWORD AS hash, USR_ROLE AS role FROM T_USER_USR ORDER BY USR_LOGIN').all() as Array<{ id: string; login: string; hash: string; role: string }>
    } finally {
        database.close()
    }
}

const sha256 = (path: string): string => createHash('sha256').update(readFileSync(path)).digest('hex')

describe('seed: a table that already holds accounts', () => {
    function seededDatabase(): string {
        const databasePath = join(workDirectory, 'seeded.db')
        // Precondition, proved elsewhere (US-002/CA-1, CA-9): the first run on a new database says that the accounts were created and creates the eleven of them.
        expectCreatedSeed(seed(databasePath))
        expect(accounts(databasePath)).toHaveLength(11)
        return databasePath
    }

    it('US-002/CA-7 says that no account was created and changes nothing on a second run with the same environment', () => {
        const databasePath = seededDatabase()
        const accountsBefore = accounts(databasePath)
        const fileBefore = sha256(databasePath)

        const result = seed(databasePath)

        expectSkippedSeed(result)
        expect(accounts(databasePath)).toEqual(accountsBefore)
        expect(sha256(databasePath)).toBe(fileBefore)
    }, TEST_TIMEOUT_MS)

    it('US-002/CA-1 says something else when it creates the accounts than when it skips the seed (CA-7)', () => {
        const databasePath = join(workDirectory, 'seeded.db')

        const created = expectCreatedSeed(seed(databasePath))
        const skipped = expectSkippedSeed(seed(databasePath))

        expect(created).not.toBe(skipped)
    }, TEST_TIMEOUT_MS)

    it('US-002/CA-3 keeps the eleven hashes of the first run when the second run has other valid passwords and another BCRYPT_COST', () => {
        const databasePath = seededDatabase()
        const accountsBefore = accounts(databasePath)
        const otherPasswords: Record<string, string> = { BCRYPT_COST: '5', SEED_PASSWORD_ADMIN: 'another-admin-password' }
        for (let i = 1; i <= 10; i++) {
            otherPasswords[`SEED_PASSWORD_BUZZER_${String(i).padStart(2, '0')}`] = `another-buzzer-password-${i}`
        }

        const result = seed(databasePath, otherPasswords)

        expectSkippedSeed(result)
        expect(accountsBefore.every(account => account.hash.startsWith('$2b$04$'))).toBe(true)
        expect(accounts(databasePath)).toEqual(accountsBefore)
    }, TEST_TIMEOUT_MS)

    const FAULTS: Array<[string, Record<string, string | undefined>]> = [
        ['a password that is too short', { SEED_PASSWORD_ADMIN: 'short' }],
        ['an empty password', { SEED_PASSWORD_BUZZER_03: '' }],
        ['a password that is absent', { SEED_PASSWORD_BUZZER_03: undefined }],
        ['a BCRYPT_COST that is invalid', { BCRYPT_COST: 'abc' }],
        ['a password that is too short and a BCRYPT_COST that is invalid', { SEED_PASSWORD_ADMIN: 'short', BCRYPT_COST: 'abc' }]
    ]

    it.each(FAULTS)('US-002/CA-7 comes before the passwords (CA-4) and BCRYPT_COST (CA-6): with %s, the same line, exit code 0, nothing on the error output, nothing changed', (_label, overrides) => {
        const databasePath = seededDatabase()
        const accountsBefore = accounts(databasePath)
        const reference = expectSkippedSeed(seed(databasePath))

        const result = seed(databasePath, overrides)

        expect(expectSkippedSeed(result)).toBe(reference)
        expect(accounts(databasePath)).toEqual(accountsBefore)
    }, TEST_TIMEOUT_MS)

    describe('with a table that holds a single account', () => {
        const STORED = { id: '0192f0f0-0000-7000-8000-000000000001', username: 'quiz_buzzer_07', password: 'a-hash-that-no-run-may-rewrite', role: UserRole.PLAYER }

        // The table is prepared with the real repository, that creates the real schema, not with a schema made up by the test.
        function databaseWithOneAccount(): string {
            const databasePath = join(workDirectory, 'one.db')
            const database = new Database(databasePath)
            try {
                void new SqliteUserRepository(database).insert(STORED)
            } finally {
                database.close()
            }
            return databasePath
        }

        it('US-002/CA-7 skips the seed: this account alone stays, and no account is added', () => {
            const databasePath = databaseWithOneAccount()
            const accountsBefore = accounts(databasePath)
            expect(accountsBefore).toEqual([{ id: STORED.id, login: STORED.username, hash: STORED.password, role: 'buzzer' }])

            const result = seed(databasePath)

            expectSkippedSeed(result)
            expect(accounts(databasePath)).toEqual(accountsBefore)
        }, TEST_TIMEOUT_MS)

        it('US-002/CA-7 skips the seed on this table even with a wrong password and an invalid BCRYPT_COST', () => {
            const databasePath = databaseWithOneAccount()
            const accountsBefore = accounts(databasePath)

            const result = seed(databasePath, { SEED_PASSWORD_ADMIN: 'short', BCRYPT_COST: 'abc' })

            expectSkippedSeed(result)
            expect(accounts(databasePath)).toEqual(accountsBefore)
        }, TEST_TIMEOUT_MS)
    })
})

// US-002/CA-4 (decision #74) on the real process. The rules of the policy are proved by owasp-password-validator.test.ts and the wiring
// of the service by seed-users.test.ts; here we prove what only the process shows: a missing or refused password stops the seed with exit
// code 1, an empty standard output, one `User seeding failed: ` line on the error output that names the one account and never the
// password, and no account in the database. Only the prefix, the name of the account and the absence of the password are normative:
// the wording after the prefix is not fixed. One account is faulty at a time (which of two faulty accounts comes first is not specified).
// The eleven accounts are all proved for a missing password; the refused values are proved on the first account of the order of US-002
// (admin) and on the last (quiz_buzzer_10), as the policy does not depend on the account and each run costs a process.
describe('seed: passwords', () => {
    const LOGINS = ['admin', ...Array.from({ length: 10 }, (_, i) => `quiz_buzzer_${String(i + 1).padStart(2, '0')}`)]
    const variableOf = (login: string): string => 'SEED_PASSWORD_' + login.replace(/^quiz_/, '').toUpperCase()
    const printable = (length: number): string => 'Ab1-'.repeat(Math.ceil(length / 4)).slice(0, length)
    // The two accounts on which the refused values are proved.
    const PROVED_LOGINS = ['admin', 'quiz_buzzer_10']
    // The border values of the length (12 and 72 are valid, 11 and 73 are not), then one value for each other rule.
    const REFUSED_PASSWORDS: Array<[string, string]> = [
        ['an empty string', ''],
        ['11 characters, one under the minimum', printable(11)],
        ['73 characters, one over the maximum', printable(73)],
        ['a tab among 12 characters', 'pass\tword-123'],
        ['a line feed among 12 characters', 'pass\nword-123'],
        ['a character beyond printable ASCII among 12 characters', 'passwörd-123'],
        ['12 spaces', ' '.repeat(12)],
        ['72 spaces', ' '.repeat(72)]
    ]

    const ACCEPTED_PASSWORDS: Array<[string, string]> = [
        ['12 printable characters, the minimum', printable(12)],
        ['72 printable characters, the maximum', printable(72)],
        ['11 spaces then one visible character', ' '.repeat(11) + 'x'],
        ['one visible character then 71 spaces', 'x' + ' '.repeat(71)]
    ]

    function failedOn(login: string, overrides: Record<string, string | undefined>) {
        const databasePath = join(workDirectory, 'quiz.db')
        const result = seed(databasePath, overrides)
        return { result, databasePath, others: LOGINS.filter(other => other !== login) }
    }

    function expectRefusedAccount(run: ReturnType<typeof failedOn>, login: string): void {
        const { result, databasePath, others } = run
        expect(result.status).toBe(1)
        expect(result.stdout).toBe('')
        expect(result.stderr).toMatch(FAILURE)
        expect(result.stderr.split(/\r?\n/).filter(line => line.startsWith('User seeding failed'))).toHaveLength(1)
        expect(result.stderr).not.toMatch(STACK_TRACE)
        expect(result.stderr).toContain(login)
        for (const other of others) expect(result.stderr).not.toContain(other)
        // The opening created the file and its table, the refusal came before any insertion (decision #65): no account.
        expect(rowCounts(databasePath)).toEqual({ T_USER_USR: 0 })
    }

    it.each(LOGINS)('US-002/CA-4 refuses to run when the password of %s is not defined: exit code 1, one account named, no account created', (login) => {
        const run = failedOn(login, { [variableOf(login)]: undefined })

        expectRefusedAccount(run, login)
    }, TEST_TIMEOUT_MS)

    describe.each(PROVED_LOGINS)('with the password of %s', (login) => {
        it.each(REFUSED_PASSWORDS)('US-002/CA-4 refuses %s: exit code 1, only this account named, no account created', (_name, password) => {
            const run = failedOn(login, { [variableOf(login)]: password })

            expectRefusedAccount(run, login)
        }, TEST_TIMEOUT_MS)

        it.each(REFUSED_PASSWORDS.filter(([, password]) => password.trim() !== ''))('US-002/CA-4 does not repeat the password of %s in the message (%s)', (_name, password) => {
            const run = failedOn(login, { [variableOf(login)]: password })

            expect(run.result.stderr).not.toContain(password)
        }, TEST_TIMEOUT_MS)

        // The border values of the length, and spaces that are not alone: "not only spaces" is not "without a space at the border".
        it.each(ACCEPTED_PASSWORDS)('US-002/CA-4 accepts %s: exit code 0, the success line, eleven accounts', (_name, password) => {
            const databasePath = join(workDirectory, 'quiz.db')

            const result = seed(databasePath, { [variableOf(login)]: password })

            expectCreatedSeed(result)
            expect(countAccounts(databasePath)).toBe(11)
        }, TEST_TIMEOUT_MS)
    })
})

// US-002/CA-6 and decision #74: BCRYPT_COST is an integer from 4 to 31 written in ASCII digits only, without a leading zero; absent or an
// empty string, it is 12. Anything else that is set (blank-only values included) is refused. The wording after "User seeding failed: " is
// not normative (CA-6): the tests fix the prefix, the name of the variable, the rule (the two bounds), the absence of the value, the exit
// code, the empty standard output, the absence of a stack trace and that nothing is created. The bound 31 is not proved on the real process:
// bcrypt at cost 31 takes hours, so the acceptance of 31 stays at the unit level (bcrypt-cost.test.ts, seed-users.test.ts; see DEBTS.md).
describe('seed: BCRYPT_COST', () => {
    const REFUSED_COSTS: Array<[string, string]> = [
        ['abc', 'abc'],
        ['12.5', '12.5'],
        ['3, one under the minimum', '3'],
        ['32, one over the maximum', '32'],
        ['-1', '-1'],
        ['12 with a leading space', ' 12'],
        ['0', '0'],
        ['4.0', '4.0'],
        ['+5', '+5'],
        ['004, a leading zero', '004'],
        ['04, a leading zero', '04'],
        ['an Arabic-Indic digit', '٤'],
        ['an integer of twenty digits', '1'.repeat(20)],
        ['a space alone', ' '],
        ['a tab alone', '\t']
    ]
    // A message cannot be told to repeat a value that its own fixed words contain ("3" in "31", a space between two words, "0"): the
    // absence of the value is proved on the values that no wording of the rule can contain by itself.
    const DISTINCTIVE_REFUSED_COSTS = REFUSED_COSTS.filter(([, value]) => value.length > 1 || /[^\x20-\x7E]/.test(value))

    function refusedRun(value: string) {
        const databasePath = join(workDirectory, 'quiz.db')
        return { result: seed(databasePath, { BCRYPT_COST: value }), databasePath }
    }

    // The cost bcrypt wrote in the stored hash: "$2b$<cost>$<salt and digest>".
    function storedCosts(databasePath: string): number[] {
        return accounts(databasePath).map(({ hash }) => {
            const match = /^\$2b\$(\d{2})\$/.exec(hash)
            expect(match, 'a bcrypt hash of the 2b family').not.toBeNull()
            return Number(match![1])
        })
    }

    it.each(REFUSED_COSTS)('US-002/CA-6 refuses %s: exit code 1, BCRYPT_COST and the rule named, nothing on the standard output, no account created', (_name, value) => {
        const { result, databasePath } = refusedRun(value)

        expect(result.status).toBe(1)
        expect(result.stdout).toBe('')
        expect(result.stderr).toMatch(FAILURE)
        expect(result.stderr.split(/\r?\n/).filter(line => line.startsWith('User seeding failed'))).toHaveLength(1)
        expect(result.stderr).not.toMatch(STACK_TRACE)
        expect(result.stderr).toContain('BCRYPT_COST')
        expect(result.stderr).toMatch(/\b4\b/)
        expect(result.stderr).toMatch(/\b31\b/)
        // The opening created the file and its table, the refusal came before any insertion, and the file is not deleted (decision #65).
        expect(rowCounts(databasePath)).toEqual({ T_USER_USR: 0 })
    }, TEST_TIMEOUT_MS)

    it.each(DISTINCTIVE_REFUSED_COSTS)('US-002/CA-6 does not repeat the value in the message (%s)', (_name, value) => {
        const { result } = refusedRun(value)

        expect(result.status).toBe(1)
        expect(result.stderr).not.toContain(value)
    }, TEST_TIMEOUT_MS)

    // 4 is the lowest cost, 10 an intermediate one. 31 is not run here (hours of computation, see above).
    it.each([['4, the minimum', '4', 4], ['10, an intermediate value', '10', 10]] as const)('US-002/CA-6 accepts %s: exit code 0, the success line, eleven accounts hashed at this cost', (_name, value, cost) => {
        const databasePath = join(workDirectory, 'quiz.db')

        const result = seed(databasePath, { BCRYPT_COST: value })

        expectCreatedSeed(result)
        expect(countAccounts(databasePath)).toBe(11)
        expect(storedCosts(databasePath)).toEqual(Array(11).fill(cost))
    }, TEST_TIMEOUT_MS)

    // 12 is an implementation choice observable through the database only: the cost written in the stored hash (eleven hashes at cost 12 take a few seconds).
    it.each([['not defined', undefined], ['an empty string', '']] as const)('US-002/CA-6 uses the cost 12 when BCRYPT_COST is %s: exit code 0, the success line, eleven accounts hashed at cost 12', (_name, value) => {
        const databasePath = join(workDirectory, 'quiz.db')

        const result = seed(databasePath, { BCRYPT_COST: value })

        expectCreatedSeed(result)
        expect(countAccounts(databasePath)).toBe(11)
        expect(storedCosts(databasePath)).toEqual(Array(11).fill(12))
    }, TEST_TIMEOUT_MS)
})

// How a .env file writes SQLITE_DB_PATH for the seed (US-002 CA-8, "Origine de la valeur", decision #71, point 2). The rule bears on the value
// the process receives; the .env file is read by the `dotenv` library (17.4.0), loaded by `import 'dotenv/config'` as for the hub, and what
// these tests observe on the real process (unquoted values trimmed, quoted values kept, " #" starting a comment) is what that library does,
// not something the specification prescribes. The CDC says these cases were probed on the hub, not on the seed: here they are observed on the
// seed itself, and any difference from the hub table of decision #71 would be a finding to report, not a thing to assert at will.
// A change of behaviour of a new `dotenv` version would show up here and must be observed again, not silently followed.
// The real environment has no SQLITE_DB_PATH, so the .env file alone writes it (`dotenv` does not override the real environment).
// The working directory is the temporary one: a relative path of the .env file names a file of this directory.
describe('seed: SQLITE_DB_PATH written in a .env file', () => {
    function seedWithEnvFile(content: string) {
        writeFileSync(join(workDirectory, '.env'), content)
        return seed(undefined)
    }

    function expectRefusedAsBlank(result: { status: number | null; stdout: string; stderr: string }): void {
        expect(result.status).toBe(1)
        expect(result.stderr).toContain(REFUSAL)
        // The message is the refusal itself: the line carries no other text, so no value is repeated in it.
        expect(result.stderr.split(/\r?\n/).filter(line => line.startsWith('User seeding failed'))).toEqual([REFUSAL])
        expect(result.stderr).not.toMatch(STACK_TRACE)
        expect(result.stdout).toBe('')
        expect(readdirSync(workDirectory)).toEqual(['.env'])
    }

    // `file` is the only file the seed creates next to the .env file; null when it creates none (an in-memory database).
    function expectSeededAt(result: { status: number | null; stdout: string; stderr: string }, file: string | null): void {
        expectCreatedSeed(result)
        expect(readdirSync(workDirectory).sort()).toEqual(file === null ? ['.env'] : ['.env', file].sort())
        if (file !== null) expect(countAccounts(join(workDirectory, file))).toBe(11)
    }

    it.each([
        ['spaces', '   '],
        ['tabulations', '\t\t'],
        ['U+3000', '　　']
    ] as const)('US-002/CA-8 refuses an unquoted SQLITE_DB_PATH made only of %s, read empty (decision #71): exit code 1, the message on the error output without the value, no file created', (_name, blank) => {
        expectRefusedAsBlank(seedWithEnvFile('SQLITE_DB_PATH=' + blank + '\n'))
    }, TEST_TIMEOUT_MS)

    it.each([
        ['spaces between double quotes', 'SQLITE_DB_PATH="   "'],
        ['spaces between single quotes', "SQLITE_DB_PATH='   '"],
        ['spaces between backticks', 'SQLITE_DB_PATH=`   `'],
        ['a backslash-n between double quotes, expanded by dotenv to a line feed', 'SQLITE_DB_PATH="\\n"']
    ] as const)('US-002/CA-8 refuses a quoted SQLITE_DB_PATH made only of blanks, kept by dotenv then read by the rule (decision #71): %s: exit code 1, the message without the value, no file created', (_name, line) => {
        expectRefusedAsBlank(seedWithEnvFile(line + '\n'))
    }, TEST_TIMEOUT_MS)

    it.each([
        ['keeps the blanks inside an unquoted value: the file is named with them', 'SQLITE_DB_PATH=my data.db', 'my data.db'],
        ['starts a comment at an unquoted " #": the value stops before it', 'SQLITE_DB_PATH=real.db # note', 'real.db'],
        ['trims the blanks around an unquoted value', 'SQLITE_DB_PATH=   trimmed.db  ', 'trimmed.db'],
        ['keeps the blanks of a quoted value, then reads it without the blanks around it', 'SQLITE_DB_PATH="  padded.db  "', 'padded.db'],
        ['reads a quoted " :memory: " as :memory:: no file is created', 'SQLITE_DB_PATH=" :memory: "', null],
        ['accepts an unquoted :memory:: no file is created', 'SQLITE_DB_PATH=:memory:', null],
        ['accepts an unquoted U+200B alone: the file is named by this one character', 'SQLITE_DB_PATH=​', '​']
    ] as const)('US-002/CA-8 %s (decision #71): exit code 0, the success line', (_name, line, file) => {
        expectSeededAt(seedWithEnvFile(line + '\n'), file)
    }, TEST_TIMEOUT_MS)

    it('US-002/CA-8 does not read the .env file when the real environment has its own SQLITE_DB_PATH (the file of the environment is the one created)', () => {
        writeFileSync(join(workDirectory, '.env'), 'SQLITE_DB_PATH=from-env-file.db\n')

        const result = seed('from-environment.db')

        expectCreatedSeed(result)
        expect(readdirSync(workDirectory).sort()).toEqual(['.env', 'from-environment.db'])
    }, TEST_TIMEOUT_MS)
})

// US-002/CA-2: the passwords are read from environment variables (a .env file, not versioned), then hashed with bcrypt before insertion.
// The .env file is read by `dotenv` (`import 'dotenv/config'`), which does not override the real environment (decision #52): proved here on
// the real process, as for SQLITE_DB_PATH above (decision #71). The eleven variables are removed from the environment of the child process
// (an override set to undefined), so that only the .env file of the temporary working directory can write them; no .env of the repository
// is read, the working directory being the temporary one. BCRYPT_COST stays 4 in the real environment, as in every other test of the seed.
// A stored hash is checked with the bcrypt library of the project against the password written for its own account.
describe('seed: passwords written in a .env file', () => {
    const LOGINS = ['admin', ...Array.from({ length: 10 }, (_, i) => `quiz_buzzer_${String(i + 1).padStart(2, '0')}`)]
    const variableOf = (login: string): string => 'SEED_PASSWORD_' + login.replace(/^quiz_/, '').toUpperCase()
    // One distinct password per account, so that a hash made from another account's password cannot match.
    const envFilePasswordOf = (login: string): string => `from-the-env-file-${login}`
    const ABSENT_FROM_THE_REAL_ENVIRONMENT = Object.fromEntries(LOGINS.map(login => [variableOf(login), undefined]))

    function writeEnvFile(passwords: Record<string, string>): void {
        writeFileSync(join(workDirectory, '.env'), LOGINS.map(login => `${variableOf(login)}=${passwords[login]}\n`).join(''))
    }

    function storedHashOf(databasePath: string, login: string): string {
        const account = accounts(databasePath).find(candidate => candidate.login === login)
        expect(account, `the account ${login} is stored`).toBeDefined()
        return account!.hash
    }

    it('US-002/CA-2 reads the eleven passwords from a .env file, absent from the real environment, and stores each as a bcrypt hash of the password written for its account', () => {
        const databasePath = join(workDirectory, 'quiz.db')
        writeEnvFile(Object.fromEntries(LOGINS.map(login => [login, envFilePasswordOf(login)])))

        const result = seed(databasePath, ABSENT_FROM_THE_REAL_ENVIRONMENT)

        expectCreatedSeed(result)
        expect(accounts(databasePath).map(account => account.login).sort()).toEqual([...LOGINS].sort())
        for (const login of LOGINS) {
            const hash = storedHashOf(databasePath, login)
            expect(hash, `${login}: not the password in clear`).not.toBe(envFilePasswordOf(login))
            expect(hash, `${login}: a bcrypt hash`).toMatch(/^\$2[abxy]\$\d{2}\$/)
            expect(bcrypt.compareSync(envFilePasswordOf(login), hash), `${login}: the hash matches the password of its .env line`).toBe(true)
        }
    }, TEST_TIMEOUT_MS)

    it.each(['admin', 'quiz_buzzer_10'])('US-002/CA-2 prefers the password of the real environment to the one of the .env file for the same variable (%s): the stored hash matches the real one, the other accounts still come from the .env file (decision #52)', (login) => {
        const databasePath = join(workDirectory, 'quiz.db')
        const realPassword = `from-the-real-environment-${login}`
        writeEnvFile(Object.fromEntries(LOGINS.map(other => [other, envFilePasswordOf(other)])))

        const result = seed(databasePath, { ...ABSENT_FROM_THE_REAL_ENVIRONMENT, [variableOf(login)]: realPassword })

        expectCreatedSeed(result)
        const hash = storedHashOf(databasePath, login)
        expect(bcrypt.compareSync(realPassword, hash), 'the hash matches the password of the real environment').toBe(true)
        expect(bcrypt.compareSync(envFilePasswordOf(login), hash), 'the hash does not match the password of the .env file').toBe(false)
        for (const other of LOGINS.filter(candidate => candidate !== login)) {
            expect(bcrypt.compareSync(envFilePasswordOf(other), storedHashOf(databasePath, other)), `${other}: read from the .env file`).toBe(true)
        }
    }, TEST_TIMEOUT_MS)
})

// The permission tests cannot prove anything where permissions do not apply: root ignores them (the seed writes, decision #72, point 6)
// and Windows does not have the POSIX ones (the seed was not probed there). They are skipped, with the reason in the title and on the console,
// never silently green. A final probe covers any other machine where chmod has no effect. Same model as src/index.test.ts.
function filePermissionsSkipReason(): string | undefined {
    if (process.platform === 'win32') return 'Windows: POSIX file permissions do not apply'
    if (process.getuid?.() === 0) return 'running as root: file permissions have no effect'
    const probeDirectory = mkdtempSync(join(tmpdir(), 'quiz-seed-permission-probe-'))
    try {
        const file = join(probeDirectory, 'file')
        writeFileSync(file, 'x')
        chmodSync(file, 0o000)
        let readable = true
        try { readFileSync(file) } catch { readable = false }
        if (readable) return 'a chmod 000 file can still be read: file permissions have no effect here'
        chmodSync(file, 0o644)
        const folder = join(probeDirectory, 'folder')
        mkdirSync(folder)
        chmodSync(folder, 0o555)
        let writable = true
        try { writeFileSync(join(folder, 'file'), 'x') } catch { writable = false }
        if (writable) return 'a file can still be created in a chmod 555 directory: directory permissions have no effect here'
        return undefined
    } finally {
        restorePermissions(probeDirectory)
        rmSync(probeDirectory, { recursive: true, force: true })
    }
}

const FILE_PERMISSIONS_SKIP = filePermissionsSkipReason()
if (FILE_PERMISSIONS_SKIP !== undefined) console.warn('[seed.test] SKIPPED the read-only database tests: ' + FILE_PERMISSIONS_SKIP)
const SKIPPED_PERMISSIONS = ' (skipped as root, on Windows, or where file permissions have no effect)'

// US-002/CA-9, paragraph "Base en lecture seule", decision #72 (a finding, not a rule: probed on Linux as a non-root account). The cause text of a
// refusal is the one the system gives and is not prescribed (`attempt to write a readonly database`, `unable to open database file` are findings):
// the tests fix the prefix, the exit code, the streams and the state of the database, never the cause.
describe('seed: read-only database', () => {
    // What a run must leave as it found it: the file (size, modification date, content) and what the directory holds.
    function state(databasePath: string) {
        const { size, mtimeMs } = statSync(databasePath)
        return { size, mtimeMs, sha256: sha256(databasePath), directory: readdirSync(workDirectory).sort() }
    }

    // The tables are made by the real repositories, as the seed and the hub make them, not by a schema made up by the test.
    function userTableOnly(databasePath: string): void {
        const database = new Database(databasePath)
        try {
            void new SqliteUserRepository(database)
        } finally {
            database.close()
        }
    }

    function threeTables(databasePath: string): void {
        const database = new Database(databasePath)
        try {
            void new SqliteUserRepository(database)
            void new SqliteThemeRepository(database)
            void new SqliteQuestionRepository(database)
        } finally {
            database.close()
        }
    }

    const readOnlyFile = (databasePath: string) => chmodSync(databasePath, 0o444)
    const readOnlyDirectory = () => chmodSync(workDirectory, 0o555)

    // The eleven accounts of a first run, as `npm run seed` writes them (precondition proved elsewhere: CA-1, CA-9).
    function seededDatabase(): string {
        const databasePath = join(workDirectory, 'seeded.db')
        expectCreatedSeed(seed(databasePath))
        expect(countAccounts(databasePath)).toBe(11)
        return databasePath
    }

    function expectRefusedByTheSystem(result: { status: number | null; stdout: string; stderr: string }): void {
        expect(result.status).toBe(1)
        expect(result.stderr).toMatch(FAILURE)
        expect(result.stderr).not.toMatch(STACK_TRACE)
        expect(result.stdout).toBe('')
    }

    describe('when the table already holds accounts: nothing is written, so nothing fails', () => {
        const KINDS = [
            ['(a) a read-only file', (databasePath: string) => readOnlyFile(databasePath)],
            ['(b) a writable file in a read-only directory', () => readOnlyDirectory()]
        ] as const

        it.skipIf(FILE_PERMISSIONS_SKIP !== undefined).each(KINDS)('US-002/CA-9 and CA-7, decision #72 %s: the line of CA-7, exit code 0, nothing on the error output, the file and the directory untouched' + SKIPPED_PERMISSIONS, (_kind, lock) => {
            const databasePath = seededDatabase()
            const reference = expectSkippedSeed(seed(databasePath))
            const accountsBefore = accounts(databasePath)
            lock(databasePath)
            const before = state(databasePath)

            const result = seed(databasePath)

            expect(expectSkippedSeed(result)).toBe(reference)
            expect(state(databasePath)).toEqual(before)
            expect(before.directory).toEqual(['seeded.db'])
            expect(accounts(databasePath)).toEqual(accountsBefore)
        }, TEST_TIMEOUT_MS)

        it.skipIf(FILE_PERMISSIONS_SKIP !== undefined)('US-002/CA-9 and CA-7, decision #72 (h): on a read-only file with its accounts, a wrong password and an invalid BCRYPT_COST change nothing: the line of CA-7, exit code 0 (CA-7 comes before CA-4 and CA-6)' + SKIPPED_PERMISSIONS, () => {
            const databasePath = seededDatabase()
            const reference = expectSkippedSeed(seed(databasePath))
            readOnlyFile(databasePath)
            const before = state(databasePath)

            const result = seed(databasePath, { SEED_PASSWORD_ADMIN: 'short', BCRYPT_COST: 'abc' })

            expect(expectSkippedSeed(result)).toBe(reference)
            expect(state(databasePath)).toEqual(before)
        }, TEST_TIMEOUT_MS)
    })

    describe('when it should write and cannot: exit code 1, User seeding failed: <cause>, nothing on the standard output, no account, the database untouched', () => {
        // `prepare` builds the database (and its lock) in the working directory; `file` is the one it leaves there; `tables` is what a run must leave in it.
        const KINDS = [
            ['(c) a read-only file with the three tables and no account', 'c.db', (databasePath: string) => { threeTables(databasePath); readOnlyFile(databasePath) }, { T_QUESTION_QST: 0, T_THEME_THM: 0, T_USER_USR: 0 }],
            ['(d) a read-only file with the table of the seed only, no account', 'd.db', (databasePath: string) => { userTableOnly(databasePath); readOnlyFile(databasePath) }, { T_USER_USR: 0 }],
            ['(e) a read-only file of zero bytes', 'e.db', (databasePath: string) => { writeFileSync(databasePath, ''); readOnlyFile(databasePath) }, {}],
            ['(f) a writable file with the three tables and no account, in a read-only directory', 'f.db', (databasePath: string) => { threeTables(databasePath); readOnlyDirectory() }, { T_QUESTION_QST: 0, T_THEME_THM: 0, T_USER_USR: 0 }]
        ] as const

        it.skipIf(FILE_PERMISSIONS_SKIP !== undefined).each(KINDS)('US-002/CA-9, decision #72 %s' + SKIPPED_PERMISSIONS, (_kind, file, prepare, tables) => {
            const databasePath = join(workDirectory, file)
            prepare(databasePath)
            const before = state(databasePath)

            const result = seed(databasePath)

            expectRefusedByTheSystem(result)
            expect(state(databasePath)).toEqual(before)
            expect(before.directory).toEqual([file])
            expect(rowCounts(databasePath)).toEqual(tables)
        }, TEST_TIMEOUT_MS)

        it.skipIf(FILE_PERMISSIONS_SKIP !== undefined)('US-002/CA-9, decision #72 (g) an absent file in a read-only directory: nothing is created' + SKIPPED_PERMISSIONS, () => {
            readOnlyDirectory()

            const result = seed(join(workDirectory, 'absent.db'))

            expectRefusedByTheSystem(result)
            expect(readdirSync(workDirectory)).toEqual([])
        }, TEST_TIMEOUT_MS)
    })

    describe('order of the checks when it should write and cannot', () => {
        const readOnlyWithoutAccount = (kind: 'the three tables' | 'the table of the seed only') => {
            const databasePath = join(workDirectory, 'order.db')
            if (kind === 'the three tables') threeTables(databasePath)
            else userTableOnly(databasePath)
            readOnlyFile(databasePath)
            return databasePath
        }

        it.skipIf(FILE_PERMISSIONS_SKIP !== undefined).each(['the three tables', 'the table of the seed only'] as const)('US-002/CA-9 and CA-4, decision #72 (i): with %s and a wrong password, the password is reported, not the read-only database: exit code 1, the account named, the password not exposed' + SKIPPED_PERMISSIONS, (kind) => {
            const databasePath = readOnlyWithoutAccount(kind)
            const before = state(databasePath)

            const result = seed(databasePath, { SEED_PASSWORD_ADMIN: 'short' })

            expectRefusedByTheSystem(result)
            expect(result.stderr).toContain('admin')
            expect(result.stderr).not.toContain('short')
            expect(state(databasePath)).toEqual(before)
            expect(countAccounts(databasePath)).toBe(0)
        }, TEST_TIMEOUT_MS)

        it.skipIf(FILE_PERMISSIONS_SKIP !== undefined)('US-002/CA-9 and CA-6, decision #72 (j): with an invalid BCRYPT_COST, BCRYPT_COST is reported, not the read-only database: exit code 1, the variable named' + SKIPPED_PERMISSIONS, () => {
            const databasePath = readOnlyWithoutAccount('the three tables')
            const before = state(databasePath)

            const result = seed(databasePath, { BCRYPT_COST: 'abc' })

            expectRefusedByTheSystem(result)
            expect(result.stderr).toContain('BCRYPT_COST')
            expect(state(databasePath)).toEqual(before)
            expect(countAccounts(databasePath)).toBe(0)
        }, TEST_TIMEOUT_MS)

        it.skipIf(FILE_PERMISSIONS_SKIP !== undefined)('US-002/CA-9, decision #72 (k): on a read-only file of zero bytes, the failure of the table creation comes before the check of the passwords: exit code 1, no account named, the file still empty' + SKIPPED_PERMISSIONS, () => {
            const databasePath = join(workDirectory, 'k.db')
            writeFileSync(databasePath, '')
            readOnlyFile(databasePath)
            const before = state(databasePath)

            const result = seed(databasePath, { SEED_PASSWORD_ADMIN: 'short' })

            expectRefusedByTheSystem(result)
            expect(result.stderr).not.toContain('admin')
            expect(result.stderr).not.toContain('Invalid password')
            expect(state(databasePath)).toEqual(before)
            expect(before.size).toBe(0)
        }, TEST_TIMEOUT_MS)
    })
})
