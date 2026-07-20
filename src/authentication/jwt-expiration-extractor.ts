import { ExpirationExtractor } from "./expiration-extractor";
import jwt from "jsonwebtoken";

export class JwtExpirationExtractor implements ExpirationExtractor {
    extract(token: string): number {
        const decoded = jwt.decode(token) as jwt.JwtPayload;
        return decoded.exp as number;
    }
}