import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from 'dotenv'
import { describe, expect, it } from 'vitest'

// `.env.example` is the versioned model of the `.env` of the seed (US-002, « Format du fichier .env » and « Points de vigilance »).
// Copied as it is to `.env`, it must not change any behaviour: the two optional variables are therefore only written as comments
// (a value left empty is refused for SQLITE_DB_PATH and read as absent for BCRYPT_COST), and no value looks like a real password.
const MODEL = readFileSync(resolve(__dirname, '../.env.example'), 'utf8')
const LINES = MODEL.split(/\r?\n/)
const SEED_VARIABLES = [
    'SEED_PASSWORD_ADMIN',
    ...Array.from({ length: 10 }, (_, index) => `SEED_PASSWORD_BUZZER_${String(index + 1).padStart(2, '0')}`)
]

describe('.env.example', () => {
    it('defines exactly the eleven seed password variables, and nothing else', () => {
        expect(Object.keys(parse(MODEL))).toEqual(SEED_VARIABLES)
    })

    it('gives each seed password a placeholder naming its account, never a real value', () => {
        const parsed = parse(MODEL)
        const expected = Object.fromEntries(SEED_VARIABLES.map(name => {
            const account = name.replace(/^SEED_PASSWORD_/, '').toLowerCase()
            return [name, `<mot_de_passe_${account}_min_12_car>`]
        }))
        expect(parsed).toEqual(expected)
    })

    it.each(['BCRYPT_COST', 'SQLITE_DB_PATH'])('writes %s as a comment only, with its default', name => {
        const written = LINES.filter(line => line.includes(name))
        const commentedDefault = new RegExp(`^# ${name}=\\S+$`)
        expect(written.some(line => commentedDefault.test(line))).toBe(true)
        expect(written.every(line => line.startsWith('#'))).toBe(true)
    })

    it('warns in its header that the copied file must not be versioned', () => {
        expect(LINES[0]).toBe('# Mots de passe du seed — NE PAS VERSIONNER CE FICHIER')
    })
})
