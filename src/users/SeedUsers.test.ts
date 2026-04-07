import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IUserRepository } from "./IUserRepository";
import { SeedUsers } from './SeedUsers';
import { UserRole } from './UserRole';
import { IHasher } from '../common/IHasher';
import { IPasswordValidator } from './IPasswordValidator';

const mockEnvironment = {
    adminPassword: 'admin123',
    playerPassword: 'player123'
};

describe("CA-1 - création des 11 comptes utilisateurs s'il n'y en a pas encore", () => {
    let userSeed: SeedUsers;
    let mockRepository: IUserRepository;
    let mockHasher: IHasher;
    let mockPasswordValidator: IPasswordValidator;
    beforeEach(() => {
        mockRepository = {
            count: vi.fn().mockResolvedValue(0),
            insert: vi.fn().mockResolvedValue(undefined),
            retrieveByLogin: vi.fn().mockResolvedValue(undefined)
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
});

describe("CA-2 - Les mots de passe sont lus depuis les variables d'environnement", () => {
    let userSeed: SeedUsers;
    let mockRepository: IUserRepository;
    let mockHasher: IHasher;
    let mockPasswordValidator: IPasswordValidator;
    beforeEach(() => {
        mockRepository = {
            count: vi.fn().mockResolvedValue(0),
            insert: vi.fn().mockResolvedValue(undefined),
            retrieveByLogin: vi.fn().mockResolvedValue(undefined)
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
    it("should use environment variables for passwords", async () => {
        await userSeed.seed(mockEnvironment);
        expect(mockRepository.insert).toHaveBeenCalledWith(expect.objectContaining({ password: 'hashed_admin123', role: UserRole.ADMIN }));
        expect(mockRepository.insert).toHaveBeenCalledWith(expect.objectContaining({ password: 'hashed_player123', role: UserRole.PLAYER }));
    });
});

describe("CA-4 - Les mots de passe respectent les règles de validation", () => {
    let userSeed: SeedUsers;
    let mockRepository: IUserRepository;
    let mockHasher: IHasher;
    let mockPasswordValidator: IPasswordValidator;
    beforeEach(() => {
        mockRepository = {
            count: vi.fn().mockResolvedValue(0),
            insert: vi.fn().mockResolvedValue(undefined),
            retrieveByLogin: vi.fn().mockResolvedValue(undefined)
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
        expect(mockPasswordValidator.validate).toHaveBeenCalledWith(mockEnvironment.adminPassword);
        expect(mockPasswordValidator.validate).toHaveBeenCalledWith(mockEnvironment.playerPassword);
    });
    it("should throw an error if a password is invalid", async () => {
        vi.mocked(mockPasswordValidator.validate).mockReturnValue(false);
        await expect(userSeed.seed(mockEnvironment)).rejects.toThrow("Invalid password");
    });
});