import { IUser } from "../users/IUser";
import { Token } from "./token.interface";
import { TokenGenerator } from "./token-generator.interface";
import jwt from "jsonwebtoken";

export class JwtTokenGenerator implements TokenGenerator {
    private secretKey: string;
    private duration: number;

    constructor(secretKey: string, duration: number) {
        this.secretKey = secretKey;
        this.duration = duration;
    }

    generateToken(user: IUser): Token {
        const payload = {
                sub: user.id,
                role: user.role
            };
            const options: jwt.SignOptions = {
                expiresIn: this.duration,
                algorithm: "HS256" as jwt.Algorithm
            };
        const token = jwt.sign(payload, this.secretKey, options);
        return {
            token: token,
            expiresIn: this.duration,
            tokenType: "Bearer"
        };
    }
}