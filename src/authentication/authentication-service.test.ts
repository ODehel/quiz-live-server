import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRepository } from "../users/user-repository.interface";
import { Hasher } from "../common/hasher.interface";
import { UserRole } from "../users/user-role";
import { JwtAuthenticationService } from "./jwt-authentication-service";

describe("Login inexistant en base de données", () => {
    let mockUserRepository: UserRepository;
    beforeEach(() => {
        // Arrange : Faire un mock de IUserRepository pour qu'il retourne undefined
        mockUserRepository = {
            count: () => Promise.resolve(0),
            insertAllIfEmpty: () => Promise.resolve(0),
            retrieveByLogin: () => Promise.resolve(undefined),
            retrieveById: () => Promise.resolve(undefined)
        };
    });
    it("should return an error", async () => {
        const authenticateService = new JwtAuthenticationService(mockUserRepository, { hash: () => Promise.resolve(""), compare: () => Promise.resolve(false) });
        // Act : Appeler la méthode d'authentification avec un login qui n'existe pas
        const result = await authenticateService.authenticate("nonexistent", "password");
        // Assert : Vérifier que le résultat est undefined
        expect(result).toBeUndefined();
    });
});

describe("Login inexistant : comparaison factice du mot de passe", () => {
    const unknownUserRepository: UserRepository = {
        count: () => Promise.resolve(0),
        insertAllIfEmpty: () => Promise.resolve(0),
        retrieveByLogin: () => Promise.resolve(undefined),
        retrieveById: () => Promise.resolve(undefined)
    };

    it("should compare the provided password against a bcrypt hash of cost 12", async () => {
        // Arrange : un hasher qui enregistre ses appels de comparaison
        const compare = vi.fn<Hasher["compare"]>().mockResolvedValue(false);
        const hasher: Hasher = { hash: () => Promise.resolve(""), compare };
        const authenticateService = new JwtAuthenticationService(unknownUserRepository, hasher);
        // Act
        await authenticateService.authenticate("nonexistent", "provided-password");
        // Assert : une seule comparaison, avec le mot de passe fourni et un hash bcrypt valide de coût 12
        expect(compare).toHaveBeenCalledTimes(1);
        expect(compare).toHaveBeenCalledWith("provided-password", expect.stringMatching(/^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/));
    });

    it("should return undefined even when the dummy comparison succeeds", async () => {
        // Arrange : un hasher qui répondrait true à la comparaison factice
        const hasher: Hasher = { hash: () => Promise.resolve(""), compare: () => Promise.resolve(true) };
        const authenticateService = new JwtAuthenticationService(unknownUserRepository, hasher);
        // Act
        const result = await authenticateService.authenticate("nonexistent", "password");
        // Assert
        expect(result).toBeUndefined();
    });
});

describe("Login with wrong password", () => {
    let mockUserRepository: UserRepository;
    let hasher: Hasher;
    beforeEach(() => {
        // Arrange : Faire un mock de IUserRepository pour qu'il retourne un utilisateur avec un mot de passe hashé
        mockUserRepository = {
            count: () => Promise.resolve(1),
            insertAllIfEmpty: () => Promise.resolve(0),
            retrieveByLogin: () => Promise.resolve({ id: "1", username: "testuser", password: "$2b$10$...", role: UserRole.PLAYER }),
            retrieveById: () => Promise.resolve(undefined)
        };
        // Arrange : Faire un mock de IHasher pour qu'il retourne true lors de la comparaison
        hasher = {
            hash: () => Promise.resolve("$2b$10$..."),
            compare: () => Promise.resolve(false) // Simulate wrong password
        };
    });

    it("should return an error", async () => {
        // Arrange : Faire un mock de IUserRepository pour qu'il retourne un utilisateur
        const authenticateService = new JwtAuthenticationService(mockUserRepository, hasher);
        // Act : Appeler la méthode d'authentification avec le bon login mais un mot de passe incorrect
        const result = await authenticateService.authenticate("testuser", "wrongpassword");
        // Assert : Vérifier que le résultat est undefined
        expect(result).toBeUndefined();
    });
});

describe("Login existant : pas de comparaison factice", () => {
    it("should compare the password only against the hash of the user", async () => {
        // Arrange
        const user = { id: "1", username: "testuser", password: "$2b$12$stored-hash", role: UserRole.PLAYER };
        const repository: UserRepository = {
            count: () => Promise.resolve(1),
            insertAllIfEmpty: () => Promise.resolve(0),
            retrieveByLogin: () => Promise.resolve(user),
            retrieveById: () => Promise.resolve(undefined)
        };
        const compare = vi.fn<Hasher["compare"]>().mockResolvedValue(true);
        const authenticateService = new JwtAuthenticationService(repository, { hash: () => Promise.resolve(""), compare });
        // Act
        await authenticateService.authenticate("testuser", "password");
        // Assert : une seule comparaison, contre le hash de l'utilisateur
        expect(compare).toHaveBeenCalledTimes(1);
        expect(compare).toHaveBeenCalledWith("password", "$2b$12$stored-hash");
    });
});

describe("Login with correct credentials", () => {
    let mockUserRepository: UserRepository;
    let hasher: Hasher;
    beforeEach(() => {
        // Arrange : Faire un mock de IUserRepository pour qu'il retourne un utilisateur avec un mot de passe hashé
        mockUserRepository = {
            count: () => Promise.resolve(1),
            insertAllIfEmpty: () => Promise.resolve(0),
            retrieveByLogin: () => Promise.resolve({ id: "1", username: "testuser", password: "$2b$10$...", role: UserRole.PLAYER }),
            retrieveById: () => Promise.resolve(undefined)
        };
        // Arrange : Faire un mock de IHasher pour qu'il retourne true lors de la comparaison
        hasher = {
            hash: () => Promise.resolve("$2b$10$..."),
            compare: () => Promise.resolve(true) // Simulate correct password
        };
    });
    it("should return the user", async () => {
        // Arrange : Faire un mock de IUserRepository pour qu'il retourne un utilisateur avec un mot de passe hashé
        const authenticateService = new JwtAuthenticationService(mockUserRepository, hasher);
        // Act : Appeler la méthode d'authentification avec le bon login et le bon mot de passe
        const result = await authenticateService.authenticate("testuser", "password");
        // Assert : Vérifier que le résultat est l'utilisateur attendu
        expect(result).toEqual({ id: "1", username: "testuser", password: "$2b$10$...", role: UserRole.PLAYER });
    });
});
