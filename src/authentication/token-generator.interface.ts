import { IUser } from "../users/IUser";
import { Token } from "./token.interface";

export interface TokenGenerator {
    generateToken(user: IUser): Token;
}