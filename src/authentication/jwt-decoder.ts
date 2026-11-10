import { fromRoleLabel } from "../users/role-label";
import { DecodedToken } from "./decoded-token.interface";
import { TokenDecoder } from "./token-decoder.interface";
import jwt from "jsonwebtoken";

export class JwtDecoder implements TokenDecoder {
    decode(token: string): DecodedToken | undefined {
        const payLoad: jwt.JwtPayload | null | string = jwt.decode(token);

        if (typeof payLoad !== 'object' || payLoad === null) {
            return undefined;
        }
        const role = fromRoleLabel(payLoad.role);
        if (role === undefined) {
            return undefined;
        }
        return { role };
    }
}
