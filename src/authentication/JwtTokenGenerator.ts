import { IUser } from "../users/IUser";
import { IToken } from "./IToken";
import { ITokenGenerator } from "./ITokenGenerator";
import jwt from "jsonwebtoken";

export class JwtTokenGenerator implements ITokenGenerator {
    private secretKey: string;
    private duration: number;

    constructor(secretKey: string, duration: number) {
        this.secretKey = secretKey;
        this.duration = duration;
    }

    generateToken(user: IUser): IToken {
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