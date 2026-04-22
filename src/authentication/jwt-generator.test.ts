import { beforeEach, describe, expect, it } from "vitest";
import { User } from "../users/user.interface";
import { UserRole } from "../users/user-role";
import { JwtGenerator } from "./jwt-generator";
import jwt from "jsonwebtoken";

const secretKey = "mysecretkey";
const duration = 3600;
let userMock: User;

describe("US-003/CA-001 - Token generation", () => {
    beforeEach(() => {
        // Réinitialiser les données ou les mocks nécessaires avant chaque test
        userMock = {
            id: "123",
            username: "testuser",
            password: "password",
            role: UserRole.PLAYER
        };
    });
    it("should generate a valid token for a user", async () => {
        const tokenGenerator = new JwtGenerator(secretKey, duration);
        const itoken = tokenGenerator.generateToken(userMock);
        const token = itoken.token;
        const decoded = jwt.verify(token, secretKey);
        expect(decoded).toHaveProperty("sub", userMock.id);
        expect(decoded).toHaveProperty("role", userMock.role);
    });
});

describe("US-003/CA-002 - HS256 algorithm", () => {
    beforeEach(() => {
        // Réinitialiser les données ou les mocks nécessaires avant chaque test
        userMock = {
            id: "123",
            username: "testuser",
            password: "password",
            role: UserRole.PLAYER
        };
    });
    it("should have hs256 encoded in the token", async () => {
        const tokenGenerator = new JwtGenerator(secretKey, duration);
        const itoken = tokenGenerator.generateToken(userMock);
        const token = itoken.token;
        const decodedHeader = JSON.parse(Buffer.from(token.split(".")[0], "base64").toString());
        expect(decodedHeader).toHaveProperty("alg", "HS256");
    });
});

describe("US-003/CA-003 - Claims are correctly set", () => {
    beforeEach(() => {
        // Réinitialiser les données ou les mocks nécessaires avant chaque test
        userMock = {
            id: "123",
            username: "testuser",
            password: "password",
            role: UserRole.PLAYER
        };
    });
    it("should include the correct user information in the token", async () => {
        const tokenGenerator = new JwtGenerator(secretKey, duration);
        const itoken = tokenGenerator.generateToken(userMock);
        const token = itoken.token;
        const decoded = jwt.verify(token, secretKey);
        expect(decoded).toHaveProperty("sub", userMock.id);
        expect(decoded).toHaveProperty("role");
        expect(decoded).toHaveProperty("iat");
        expect(decoded).toHaveProperty("exp");
    });
});

describe("US-003/CA-004 - Token expiration", () => {
    beforeEach(() => {
        // Réinitialiser les données ou les mocks nécessaires avant chaque test
        userMock = {
            id: "123",
            username: "testuser",
            password: "password",
            role: UserRole.PLAYER
        };
    });
    it("should have an expiration time set in the token", async () => {
        const tokenGenerator = new JwtGenerator(secretKey, duration);
        const itoken = tokenGenerator.generateToken(userMock);
        const token = itoken.token;
        const decoded = jwt.verify(token, secretKey);
        expect(decoded).toHaveProperty("exp");
    });
});