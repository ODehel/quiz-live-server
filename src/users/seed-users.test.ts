import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UserRepository } from "./user-repository.interface";
import { SeedUsers } from './seed-users';
import { UserRole } from './user-role';
import { User } from './user.interface';
import { Hasher } from '../common/hasher.interface';
import { PasswordValidator } from './password-validator.interface';
import { SeedUserConfiguration } from './seed-user-configuration.interface';
import { SqliteUserRepository } from './sqlite-user-repository';
import Database from 'better-sqlite3';
import { BcryptHasher } from '../infrastructure/bcrypt-hasher';
import { OwaspPasswordValidator } from './owasp-password-validator';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const logins = ['admin', ...Array.from({ length: 10 }, (_, i) => `quiz_buzzer_${String(i + 1).padStart(2, '0')}`)];

const passwordOf = (login: string) => `password-of-${login}`;

const configurationWith = (overrides: Record<string, string | undefined> = {}, bcryptCost?: string): SeedUserConfiguration => ({
    seedPasswordFor: vi.fn((login: string) => login in overrides ? overrides[login] : passwordOf(login)),
    bcryptCost: vi.fn(() => bcryptCost)
});

const mockEnvironment: SeedUserConfiguration = configurationWith();

const writtenUsers = (repository: UserRepository): User[] => vi.mocked(repository.insertAllIfEmpty).mock.calls.flatMap(call => call[0]);

describe("CA-1 - création des 11 comptes utilisateurs s'il n'y en a pas encore", () => {
    let userSeed: SeedUsers;
    let mockRepository: UserRepository;
    let mockHasher: Hasher;
    let mockPasswordValidator: PasswordValidator;
    beforeEach(() => {
        mockRepository = {
            count: vi.fn().mockResolvedValue(0),
            insert: vi.fn().mockResolvedValue(undefined),
            insertAllIfEmpty: vi.fn().mockResolvedValue(true),
            retrieveByLogin: vi.fn().mockResolvedValue(undefined),
            retrieveById: vi.fn().mockResolvedValue(undefined)
        };
        mockHasher = {
            hash: vi.fn().mockResolvedValue(undefined),
            compare: vi.fn().mockResolvedValue(true)
        };
        mockPasswordValidator = {
            validate: vi.fn().mockReturnValue(true)
        };
        userSeed = new SeedUsers(mockRepository, mockHasher, mockPasswordValidator);
    });
    it("should create 11 user accounts if there are none", async () => {
        await userSeed.seed(mockEnvironment);
        expect(mockRepository.count).toHaveBeenCalled();
        expect(mockRepository.insertAllIfEmpty).toHaveBeenCalledTimes(1);
        expect(writtenUsers(mockRepository)).toHaveLength(11);
        expect(mockRepository.insert).not.toHaveBeenCalled();
    });
    it("should not create user accounts if there are already some", async () => {
        vi.mocked(mockRepository.count).mockResolvedValue(5);
        await userSeed.seed(mockEnvironment);
        expect(mockRepository.count).toHaveBeenCalled();
        expect(mockRepository.insertAllIfEmpty).not.toHaveBeenCalled();
    });
    it("should stop before reading the passwords if there are already some accounts", async () => {
        vi.mocked(mockRepository.count).mockResolvedValue(1);
        const configuration = configurationWith({ admin: undefined });
        await userSeed.seed(configuration);
        expect(configuration.seedPasswordFor).not.toHaveBeenCalled();
    });
    it("should report that the accounts were created when the table is empty", async () => {
        const result = await userSeed.seed(mockEnvironment);
        expect(result).toEqual({ created: true });
    });
});

describe("CA-7 - le seed dit qu'aucun compte n'a été créé quand la table n'est pas vide", () => {
    let userSeed: SeedUsers;
    let mockRepository: UserRepository;
    beforeEach(() => {
        mockRepository = {
            count: vi.fn().mockResolvedValue(5),
            insert: vi.fn().mockResolvedValue(undefined),
            insertAllIfEmpty: vi.fn().mockResolvedValue(true),
            retrieveByLogin: vi.fn().mockResolvedValue(undefined),
            retrieveById: vi.fn().mockResolvedValue(undefined)
        };
        userSeed = new SeedUsers(mockRepository, { hash: vi.fn(), compare: vi.fn() }, { validate: vi.fn() });
    });
    it("should say that nothing was created because the table is not empty", async () => {
        const result = await userSeed.seed(mockEnvironment);
        expect(result).toEqual({
            created: false,
            message: "Seed ignoré — la table T_USER_USR contient déjà des comptes."
        });
        expect(mockRepository.insertAllIfEmpty).not.toHaveBeenCalled();
    });
    it("should say the same when another run filled the table between the check and the write", async () => {
        vi.mocked(mockRepository.count).mockResolvedValue(0);
        vi.mocked(mockRepository.insertAllIfEmpty).mockResolvedValue(false);
        const seedWithValidPasswords = new SeedUsers(mockRepository, { hash: vi.fn().mockResolvedValue('a-hash'), compare: vi.fn() }, { validate: vi.fn().mockReturnValue(true) });
        const result = await seedWithValidPasswords.seed(mockEnvironment);
        expect(result).toEqual({
            created: false,
            message: "Seed ignoré — la table T_USER_USR contient déjà des comptes."
        });
    });
});

describe("CA-2 - Les mots de passe sont lus depuis les variables d'environnement", () => {
    let userSeed: SeedUsers;
    let mockRepository: UserRepository;
    let mockHasher: Hasher;
    let mockPasswordValidator: PasswordValidator;
    beforeEach(() => {
        mockRepository = {
            count: vi.fn().mockResolvedValue(0),
            insert: vi.fn().mockResolvedValue(undefined),
            insertAllIfEmpty: vi.fn().mockResolvedValue(true),
            retrieveByLogin: vi.fn().mockResolvedValue(undefined),
            retrieveById: vi.fn().mockResolvedValue(undefined)
        };
        mockHasher = {
            hash: vi.fn().mockImplementation((password: string) => Promise.resolve(`hashed_${password}`)),
            compare: vi.fn().mockResolvedValue(true)
        };
        mockPasswordValidator = {
            validate: vi.fn().mockReturnValue(true)
        };
        userSeed = new SeedUsers(mockRepository, mockHasher, mockPasswordValidator);
    });
    it("should give each account its own password", async () => {
        await userSeed.seed(mockEnvironment);
        for (const login of logins) {
            expect(writtenUsers(mockRepository)).toContainEqual(expect.objectContaining({ username: login, password: `hashed_${passwordOf(login)}` }));
        }
    });
    it("should give the admin account the admin role and the buzzer accounts the player role", async () => {
        await userSeed.seed(mockEnvironment);
        expect(writtenUsers(mockRepository)).toContainEqual(expect.objectContaining({ username: 'admin', role: UserRole.ADMIN }));
        expect(writtenUsers(mockRepository)).toContainEqual(expect.objectContaining({ username: 'quiz_buzzer_07', role: UserRole.PLAYER }));
    });
});

describe("CA-4 - Les mots de passe respectent les règles de validation", () => {
    let userSeed: SeedUsers;
    let mockRepository: UserRepository;
    let mockHasher: Hasher;
    let mockPasswordValidator: PasswordValidator;
    beforeEach(() => {
        mockRepository = {
            count: vi.fn().mockResolvedValue(0),
            insert: vi.fn().mockResolvedValue(undefined),
            insertAllIfEmpty: vi.fn().mockResolvedValue(true),
            retrieveByLogin: vi.fn().mockResolvedValue(undefined),
            retrieveById: vi.fn().mockResolvedValue(undefined)
        };
        mockHasher = {
            hash: vi.fn().mockImplementation((password: string) => Promise.resolve(`hashed_${password}`)),
            compare: vi.fn().mockResolvedValue(true)
        };
        mockPasswordValidator = {
            validate: vi.fn().mockReturnValue(true)
        };
        userSeed = new SeedUsers(mockRepository, mockHasher, mockPasswordValidator);
    });
    it("should validate passwords before hashing", async () => {
        await userSeed.seed(mockEnvironment);
        for (const login of logins) {
            expect(mockPasswordValidator.validate).toHaveBeenCalledWith(passwordOf(login));
        }
    });
    it("should throw an error naming the admin account if its password is invalid", async () => {
        vi.mocked(mockPasswordValidator.validate).mockImplementation((password: string) => password !== passwordOf('admin'));
        await expect(userSeed.seed(mockEnvironment)).rejects.toThrow("Invalid password for account admin");
    });
    it("should throw an error naming a buzzer account if its password is invalid", async () => {
        vi.mocked(mockPasswordValidator.validate).mockImplementation((password: string) => password !== passwordOf('quiz_buzzer_07'));
        await expect(userSeed.seed(mockEnvironment)).rejects.toThrow("Invalid password for account quiz_buzzer_07");
    });
    it("should name only the first invalid account, in the order admin then quiz_buzzer_01 to quiz_buzzer_10", async () => {
        vi.mocked(mockPasswordValidator.validate).mockImplementation((password: string) => password !== passwordOf('quiz_buzzer_03') && password !== passwordOf('quiz_buzzer_09'));
        await expect(userSeed.seed(mockEnvironment)).rejects.toThrow(/^Invalid password for account quiz_buzzer_03$/);
    });
    it("should throw an error naming the account if its password is missing", async () => {
        const configuration = configurationWith({ quiz_buzzer_05: undefined });
        await expect(userSeed.seed(configuration)).rejects.toThrow("Missing password for account quiz_buzzer_05");
    });
    it("should not insert any account if a password is invalid", async () => {
        vi.mocked(mockPasswordValidator.validate).mockImplementation((password: string) => password !== passwordOf('quiz_buzzer_10'));
        await expect(userSeed.seed(mockEnvironment)).rejects.toThrow();
        expect(mockRepository.insertAllIfEmpty).not.toHaveBeenCalled();
    });
    it("should not expose the password in the error message", async () => {
        vi.mocked(mockPasswordValidator.validate).mockReturnValue(false);
        await expect(userSeed.seed(mockEnvironment)).rejects.not.toThrow(passwordOf('admin'));
    });
    it("should refuse a password made only of spaces, naming the account and without repeating the password", async () => {
        const seedWithRealValidator = new SeedUsers(mockRepository, mockHasher, new OwaspPasswordValidator());
        await expect(seedWithRealValidator.seed(configurationWith({ quiz_buzzer_04: " ".repeat(12) }))).rejects.toThrow(/^Invalid password for account quiz_buzzer_04$/);
        expect(mockRepository.insertAllIfEmpty).not.toHaveBeenCalled();
    });
});

describe("CA-6 - le seed refuse un BCRYPT_COST invalide et applique le coût au hachage", () => {
    let userSeed: SeedUsers;
    let mockRepository: UserRepository;
    let mockHasher: Hasher;
    let mockPasswordValidator: PasswordValidator;
    beforeEach(() => {
        mockRepository = {
            count: vi.fn().mockResolvedValue(0),
            insert: vi.fn().mockResolvedValue(undefined),
            insertAllIfEmpty: vi.fn().mockResolvedValue(true),
            retrieveByLogin: vi.fn().mockResolvedValue(undefined),
            retrieveById: vi.fn().mockResolvedValue(undefined)
        };
        mockHasher = {
            hash: vi.fn().mockImplementation((password: string) => Promise.resolve(`hashed_${password}`)),
            compare: vi.fn().mockResolvedValue(true)
        };
        mockPasswordValidator = {
            validate: vi.fn().mockReturnValue(true)
        };
        userSeed = new SeedUsers(mockRepository, mockHasher, mockPasswordValidator);
    });
    it("should refuse to seed when BCRYPT_COST is not valid, naming the variable and the rule", async () => {
        await expect(userSeed.seed(configurationWith({}, "abc"))).rejects.toThrow("BCRYPT_COST must be an integer between 4 and 31.");
    });
    it("should not create any account nor hash any password when BCRYPT_COST is not valid", async () => {
        await expect(userSeed.seed(configurationWith({}, "32"))).rejects.toThrow();
        expect(mockRepository.insertAllIfEmpty).not.toHaveBeenCalled();
        expect(mockHasher.hash).not.toHaveBeenCalled();
    });
    it.each([["10", 10], ["4", 4], ["31", 31]])("should hash every password with the cost %j given by BCRYPT_COST", async (raw, expected) => {
        await userSeed.seed(configurationWith({}, raw));
        expect(mockHasher.hash).toHaveBeenCalledTimes(11);
        for (const login of logins) {
            expect(mockHasher.hash).toHaveBeenCalledWith(passwordOf(login), expected);
        }
    });
    it("should hash with a cost of 12 when BCRYPT_COST is absent", async () => {
        await userSeed.seed(configurationWith({}, undefined));
        expect(mockHasher.hash).toHaveBeenCalledTimes(11);
        for (const login of logins) {
            expect(mockHasher.hash).toHaveBeenCalledWith(passwordOf(login), 12);
        }
    });
    it("should hash with a cost of 12 when BCRYPT_COST is empty", async () => {
        await userSeed.seed(configurationWith({}, ""));
        for (const login of logins) {
            expect(mockHasher.hash).toHaveBeenCalledWith(passwordOf(login), 12);
        }
    });
    it("should read BCRYPT_COST only after the table is known to be empty", async () => {
        vi.mocked(mockRepository.count).mockResolvedValue(3);
        const configuration = configurationWith({}, "abc");
        const result = await userSeed.seed(configuration);
        expect(result.created).toBe(false);
        expect(configuration.bcryptCost).not.toHaveBeenCalled();
    });
    it("should refuse an invalid password before an invalid BCRYPT_COST", async () => {
        vi.mocked(mockPasswordValidator.validate).mockImplementation((password: string) => password !== passwordOf('quiz_buzzer_02'));
        await expect(userSeed.seed(configurationWith({}, "abc"))).rejects.toThrow(/^Invalid password for account quiz_buzzer_02$/);
    });
    it("should refuse a missing password before an invalid BCRYPT_COST", async () => {
        await expect(userSeed.seed(configurationWith({ admin: undefined }, "abc"))).rejects.toThrow("Missing password for account admin");
    });
    it.each(["004", "04"])("should refuse BCRYPT_COST written with a leading zero (%j) without creating any account", async (raw) => {
        await expect(userSeed.seed(configurationWith({}, raw))).rejects.toThrow("BCRYPT_COST must be an integer between 4 and 31.");
        expect(mockRepository.insertAllIfEmpty).not.toHaveBeenCalled();
        expect(mockHasher.hash).not.toHaveBeenCalled();
    });
    it("should store hashes of the cost given by BCRYPT_COST when the real hasher is used", async () => {
        const seedWithRealHasher = new SeedUsers(mockRepository, new BcryptHasher(), mockPasswordValidator);
        await seedWithRealHasher.seed(configurationWith({}, "4"));
        expect(writtenUsers(mockRepository)).toHaveLength(11);
        for (const written of writtenUsers(mockRepository)) {
            expect(written.password).toMatch(/^\$2b\$04\$/);
        }
    });
});

describe("Seed with the SQLite repository - rôle stocké sous son libellé", () => {
    let database: Database.Database;
    let userSeed: SeedUsers;
    beforeEach(() => {
        database = new Database(':memory:');
        userSeed = new SeedUsers(
            new SqliteUserRepository(database),
            { hash: vi.fn((password: string) => Promise.resolve(`hashed_${password}`)), compare: vi.fn() },
            { validate: vi.fn().mockReturnValue(true) }
        );
    });
    const storedRoles = () => database.prepare("SELECT USR_LOGIN, USR_ROLE FROM T_USER_USR ORDER BY USR_LOGIN").all();
    it("should store the admin label for the admin account and the buzzer label for the ten buzzer accounts", async () => {
        await userSeed.seed(mockEnvironment);
        const expected = logins.map(login => ({ USR_LOGIN: login, USR_ROLE: login === 'admin' ? 'admin' : 'buzzer' })).sort((a, b) => a.USR_LOGIN.localeCompare(b.USR_LOGIN));
        expect(storedRoles()).toEqual(expected);
    });
    it("should leave the stored accounts untouched when seeded a second time", async () => {
        await userSeed.seed(mockEnvironment);
        const before = storedRoles();
        const result = await userSeed.seed(mockEnvironment);
        expect(result.created).toBe(false);
        expect(storedRoles()).toEqual(before);
    });
});

describe("Seed with the SQLite repository - identifiants stockés (US-002, étape 6)", () => {
    let database: Database.Database;
    let userSeed: SeedUsers;
    beforeEach(() => {
        database = new Database(':memory:');
        userSeed = new SeedUsers(
            new SqliteUserRepository(database),
            { hash: vi.fn((password: string) => Promise.resolve(`hashed_${password}`)), compare: vi.fn() },
            { validate: vi.fn().mockReturnValue(true) }
        );
    });
    const storedIds = () => (database.prepare("SELECT USR_ID FROM T_USER_USR").all() as { USR_ID: string }[]).map(row => row.USR_ID);
    it("should store a version-7 UUID as the id of each of the 11 accounts", async () => {
        await userSeed.seed(mockEnvironment);
        const ids = storedIds();
        expect(ids).toHaveLength(11);
        for (const id of ids) {
            expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
        }
    });
    it("should give the 11 accounts 11 different ids", async () => {
        await userSeed.seed(mockEnvironment);
        expect(new Set(storedIds()).size).toBe(11);
    });
});

describe("Seed with the SQLite repository - tout ou rien et perdante d'une course (US-002, CA-3 et CA-7)", () => {
    let directory: string;
    let database: Database.Database;
    let otherDatabase: Database.Database;
    beforeEach(() => {
        directory = mkdtempSync(join(tmpdir(), 'quiz-seed-users-'));
        database = new Database(join(directory, 'quiz.db'));
        otherDatabase = new Database(join(directory, 'quiz.db'));
    });
    afterEach(() => {
        database.close();
        otherDatabase.close();
        rmSync(directory, { recursive: true, force: true });
    });
    const storedAccounts = (db: Database.Database) =>
        db.prepare("SELECT USR_LOGIN AS login, USR_HASH_PASSWORD AS hash FROM T_USER_USR ORDER BY USR_LOGIN").all() as { login: string; hash: string }[];
    const hasherTagging = (tag: string, beforeFirstHash: () => Promise<void> = () => Promise.resolve()) => {
        let first = true;
        return {
            hash: vi.fn(async (password: string) => {
                if (first) {
                    first = false;
                    await beforeFirstHash();
                }
                return `${tag}:${password}`;
            }),
            compare: vi.fn()
        };
    };
    const seedWith = (db: Database.Database, hasher: ReturnType<typeof hasherTagging>) =>
        new SeedUsers(new SqliteUserRepository(db), hasher, { validate: vi.fn().mockReturnValue(true) });

    it("should leave no account at all when the write of one of them fails", async () => {
        const seedUsers = seedWith(database, hasherTagging("A"));
        database.exec("CREATE TRIGGER refuse_admin BEFORE INSERT ON T_USER_USR WHEN NEW.USR_LOGIN = 'admin' BEGIN SELECT RAISE(ABORT, 'write refused'); END");
        await expect(seedUsers.seed(mockEnvironment)).rejects.toThrow("write refused");
        expect(storedAccounts(database)).toEqual([]);
    });

    it("should create the 11 accounts of a new run after a run that wrote nothing", async () => {
        const seedUsers = seedWith(database, hasherTagging("A"));
        database.exec("CREATE TRIGGER refuse_admin BEFORE INSERT ON T_USER_USR WHEN NEW.USR_LOGIN = 'admin' BEGIN SELECT RAISE(ABORT, 'write refused'); END");
        await expect(seedUsers.seed(mockEnvironment)).rejects.toThrow();
        database.exec("DROP TRIGGER refuse_admin");
        const result = await seedWith(database, hasherTagging("B")).seed(mockEnvironment);
        expect(result).toEqual({ created: true });
        expect(storedAccounts(database)).toHaveLength(11);
    });

    it("should lose the race without error and without leaving an account when another run fills the table after its check", async () => {
        const winner = seedWith(otherDatabase, hasherTagging("WINNER"));
        const loserHasher = hasherTagging("LOSER", async () => {
            expect(await winner.seed(mockEnvironment)).toEqual({ created: true });
        });
        const result = await seedWith(database, loserHasher).seed(mockEnvironment);
        expect(result).toEqual({
            created: false,
            message: "Seed ignoré — la table T_USER_USR contient déjà des comptes."
        });
        const accounts = storedAccounts(database);
        expect(accounts).toHaveLength(11);
        expect(accounts.every(account => account.hash.startsWith("WINNER:"))).toBe(true);
    });
});
