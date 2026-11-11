import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserRepository } from "./user-repository.interface";
import { SeedUsers } from './seed-users';
import { UserRole } from './user-role';
import { Hasher } from '../common/hasher.interface';
import { PasswordValidator } from './password-validator.interface';
import { SeedUserConfiguration } from './seed-user-configuration.interface';

const logins = ['admin', ...Array.from({ length: 10 }, (_, i) => `quiz_buzzer_${String(i + 1).padStart(2, '0')}`)];

const passwordOf = (login: string) => `password-of-${login}`;

const configurationWith = (overrides: Record<string, string | undefined> = {}): SeedUserConfiguration => ({
    seedPasswordFor: vi.fn((login: string) => login in overrides ? overrides[login] : passwordOf(login))
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
        await expect(userSeed.seed(configuration)).resolves.toBeUndefined();
        expect(configuration.seedPasswordFor).not.toHaveBeenCalled();
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
