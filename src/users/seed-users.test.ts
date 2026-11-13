import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserRepository } from "./user-repository.interface";
import { SeedUsers } from './seed-users';
import { UserRole } from './user-role';
import { Hasher } from '../common/hasher.interface';
import { PasswordValidator } from './password-validator.interface';
import { SeedUserConfiguration } from './seed-user-configuration.interface';
import { SqliteUserRepository } from './sqlite-user-repository';
import Database from 'better-sqlite3';
import { BcryptHasher } from '../infrastructure/bcrypt-hasher';

const logins = ['admin', ...Array.from({ length: 10 }, (_, i) => `quiz_buzzer_${String(i + 1).padStart(2, '0')}`)];

const passwordOf = (login: string) => `password-of-${login}`;

const configurationWith = (overrides: Record<string, string | undefined> = {}, bcryptCost?: string): SeedUserConfiguration => ({
    seedPasswordFor: vi.fn((login: string) => login in overrides ? overrides[login] : passwordOf(login)),
    bcryptCost: vi.fn(() => bcryptCost)
});

const mockEnvironment: SeedUserConfiguration = configurationWith();

describe("CA-1 - création des 11 comptes utilisateurs s'il n'y en a pas encore", () => {
    let userSeed: SeedUsers;
    let mockRepository: UserRepository;
    let mockHasher: Hasher;
    let mockPasswordValidator: PasswordValidator;
    beforeEach(() => {
        mockRepository = {
            count: vi.fn().mockResolvedValue(0),
            insert: vi.fn().mockResolvedValue(undefined),
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
        expect(mockRepository.insert).toHaveBeenCalledTimes(11);
    });
    it("should not create user accounts if there are already some", async () => {
        vi.mocked(mockRepository.count).mockResolvedValue(5);
        await userSeed.seed(mockEnvironment);
        expect(mockRepository.count).toHaveBeenCalled();
        expect(mockRepository.insert).not.toHaveBeenCalled();
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
        expect(mockRepository.insert).not.toHaveBeenCalled();
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
            expect(mockRepository.insert).toHaveBeenCalledWith(expect.objectContaining({ username: login, password: `hashed_${passwordOf(login)}` }));
        }
    });
    it("should give the admin account the admin role and the buzzer accounts the player role", async () => {
        await userSeed.seed(mockEnvironment);
        expect(mockRepository.insert).toHaveBeenCalledWith(expect.objectContaining({ username: 'admin', role: UserRole.ADMIN }));
        expect(mockRepository.insert).toHaveBeenCalledWith(expect.objectContaining({ username: 'quiz_buzzer_07', role: UserRole.PLAYER }));
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
        expect(mockRepository.insert).not.toHaveBeenCalled();
    });
    it("should not expose the password in the error message", async () => {
        vi.mocked(mockPasswordValidator.validate).mockReturnValue(false);
        await expect(userSeed.seed(mockEnvironment)).rejects.not.toThrow(passwordOf('admin'));
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
        expect(mockRepository.insert).not.toHaveBeenCalled();
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
    it("should store hashes of the cost given by BCRYPT_COST when the real hasher is used", async () => {
        const seedWithRealHasher = new SeedUsers(mockRepository, new BcryptHasher(), mockPasswordValidator);
        await seedWithRealHasher.seed(configurationWith({}, "04"));
        expect(mockRepository.insert).toHaveBeenCalledTimes(11);
        for (const call of vi.mocked(mockRepository.insert).mock.calls) {
            expect(call[0].password).toMatch(/^\$2b\$04\$/);
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
