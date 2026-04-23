import { DecodedToken } from "./decoded-token.interface";

export interface TokenDecoder {
    decode(token: string) : DecodedToken | undefined;
}