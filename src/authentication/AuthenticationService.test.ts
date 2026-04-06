import { beforeEach, describe, expect, it } from "vitest";
import { IUserRepository } from "../users/IUserRepository";
import { IHasher } from "../common/IHasher";
import { UserRole } from "../users/UserRole";
import { AuthenticationService } from "./AuthenticationService";

describe("Login inexistant en base de données", () => {
    let mockUserRepository: IUserRepository;
    beforeEach(() => {
        // Arrange : Faire un mock de IUserRepository pour qu'il retourne undefined
        mockUserRepository = {
            count: () => Promise.resolve(0),
            insert: (user) => Promise.resolve(),
            retrieveByLogin: (login) => Promise.resolve(undefined)
        };
    });
    it("should return an error", async () => {
        const authenticateService = new AuthenticationService(mockUserRepository, {} as IHasher);
        // Act : Appeler la méthode d'authentification avec un login qui n'existe pas
        const result = await authenticateService.authenticate("nonexistent", "password");
        // Assert : Vérifier que le résultat est undefined
        expect(result).toBeUndefined();
    });
});

describe("Login with wrong password", () => {
    let mockUserRepository: IUserRepository;
    let hasher: IHasher;
    beforeEach(() => {
        // Arrange : Faire un mock de IUserRepository pour qu'il retourne un utilisateur avec un mot de passe hashé
        mockUserRepository = {
            count: () => Promise.resolve(1),
            insert: (user) => Promise.resolve(),
            retrieveByLogin: (login) => Promise.resolve({ id: "1", username: "testuser", password: "$2b$10$...", role: UserRole.PLAYER })
        };
        // Arrange : Faire un mock de IHasher pour qu'il retourne true lors de la comparaison
        hasher = {
            hash: (key) => Promise.resolve("$2b$10$..."),
            compare: (password, hash) => Promise.resolve(false) // Simulate wrong password
        };
    });

    it("should return an error", async () => {
        // Arrange : Faire un mock de IUserRepository pour qu'il retourne un utilisateur
        const authenticateService = new AuthenticationService(mockUserRepository, hasher);
        // Act : Appeler la méthode d'authentification avec le bon login mais un mot de passe incorrect
        const result = await authenticateService.authenticate("testuser", "wrongpassword");
        // Assert : Vérifier que le résultat est undefined
        expect(result).toBeUndefined();
    });
});

describe("Login with correct credentials", () => {
    let mockUserRepository: IUserRepository;
    let hasher: IHasher;
    beforeEach(() => {
        // Arrange : Faire un mock de IUserRepository pour qu'il retourne un utilisateur avec un mot de passe hashé
        mockUserRepository = {
            count: () => Promise.resolve(1),
            insert: (user) => Promise.resolve(),
            retrieveByLogin: (login) => Promise.resolve({ id: "1", username: "testuser", password: "$2b$10$...", role: UserRole.PLAYER })
        };
        // Arrange : Faire un mock de IHasher pour qu'il retourne true lors de la comparaison
        hasher = {
            hash: (key) => Promise.resolve("$2b$10$..."),
            compare: (password, hash) => Promise.resolve(true) // Simulate correct password
        };
    });
    it("should return the user", async () => {
        // Arrange : Faire un mock de IUserRepository pour qu'il retourne un utilisateur avec un mot de passe hashé
        const authenticateService = new AuthenticationService(mockUserRepository, hasher);
        // Act : Appeler la méthode d'authentification avec le bon login et le bon mot de passe
        const result = await authenticateService.authenticate("testuser", "password");
        // Assert : Vérifier que le résultat est l'utilisateur attendu
        expect(result).toEqual({ id: "1", username: "testuser", password: "$2b$10$...", role: UserRole.PLAYER });
    });
});