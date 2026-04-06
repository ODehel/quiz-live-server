import { IUser } from "../users/IUser";
import { IToken } from "./IToken";

export interface ITokenGenerator {
    generateToken(user: IUser): IToken;
}