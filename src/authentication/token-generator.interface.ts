import { User } from "../users/user.interface";
import { Token } from "./token.interface";

export interface TokenGenerator {
    generateToken(user: User): Token;
}