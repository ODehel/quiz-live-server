import { UserRole } from "../users/user-role";
import { DecodedToken } from "./decoded-token.interface";
import { TokenDecoder } from "./token-decoder.interface";
import jwt from "jsonwebtoken";

export class JwtDecoder implements TokenDecoder {
    decode(token: string): DecodedToken | undefined {
        const payLoad: jwt.JwtPayload | null | string = jwt.decode(token);

        if (typeof payLoad !== 'object' || payLoad === null) {
            return undefined;
        }
        const themePayLoad: ThemePayload = payLoad as ThemePayload;
        
        return { role: themePayLoad.role } as DecodedToken;
    }
}

interface ThemePayload extends jwt.JwtPayload {
    role: UserRole;
}