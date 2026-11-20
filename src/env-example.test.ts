import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from 'dotenv'
import { describe, expect, it } from 'vitest'
import { OwaspPasswordValidator } from './users/owasp-password-validator'

// `.env.example` is the versioned model of the `.env` of the seed (US-002, « Format du fichier .env » and « Points de vigilance », decision #75).
// Copied as it is to `.env`, it must change no behaviour but one: the seed refuses it (CA-4), because each placeholder is one character
// shorter than the minimum of the password policy. The two optional variables are only written as comments (a value left empty is
// refused for SQLITE_DB_PATH and read as absent for BCRYPT_COST). The refusal on the real process is proved by seed.test.ts.
const MODEL = readFileSync(resolve(__dirname, '../.env.example'), 'utf8')
const LINES = MODEL.split(/\r?\n/)
const SEED_VARIABLES = [
    'SEED_PASSWORD_ADMIN',
    ...Array.from({ length: 10 }, (_, index) => `SEED_PASSWORD_BUZZER_${String(index + 1).padStart(2, '0')}`)
]
const PLACEHOLDER = '<a_changer>'

// The minimum of CA-4 is not exported by the production code (it is written in the validator): it is read from the validator itself,
// as the shortest string of printable characters that it accepts, so that the invariant follows the policy and not a copy of its figure.
function minimumPasswordLength(): number {
    const validator = new OwaspPasswordValidator()
    const shortest = Array.from({ length: 72 }, (_, index) => index + 1).find(length => validator.validate('a'.repeat(length)))
    if (shortest === undefined) throw new Error('the password policy accepts no length from 1 to 72')
    return shortest
}

describe('.env.example', () => {
    it('defines exactly the eleven seed password variables, and nothing else', () => {
        expect(Object.keys(parse(MODEL))).toEqual(SEED_VARIABLES)
    })

    it('gives each of the eleven seed passwords the placeholder <a_changer>, never a real value', () => {
        expect(parse(MODEL)).toEqual(Object.fromEntries(SEED_VARIABLES.map(name => [name, PLACEHOLDER])))
    })

    it('keeps each placeholder strictly shorter than the minimum of the password policy (CA-4), so that an unedited copy is refused', () => {
        const minimum = minimumPasswordLength()
        for (const [name, value] of Object.entries(parse(MODEL))) {
            expect(value.length, `${name} must be shorter than ${minimum} characters`).toBeLessThan(minimum)
            expect(new OwaspPasswordValidator().validate(value), `${name} must be refused by the policy`).toBe(false)
        }
    })

    it.each(['BCRYPT_COST', 'SQLITE_DB_PATH'])('writes %s as a comment only, with its default', name => {
        const written = LINES.filter(line => line.includes(name))
        const commentedDefault = new RegExp(`^# ${name}=\\S+$`)
        expect(written.some(line => commentedDefault.test(line))).toBe(true)
        expect(written.every(line => line.startsWith('#'))).toBe(true)
    })

    it('says in its header that it is a model to copy to .env, then to edit', () => {
        expect(LINES[0]).toBe('# Modèle du .env du seed : copier en .env (non versionné), puis remplacer chaque valeur')
    })
})
