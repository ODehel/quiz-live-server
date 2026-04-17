import { THEME_NOT_FOUND } from "../common/error-codes";

export class ThemeNotFoundError extends Error {
    constructor() {
        super(THEME_NOT_FOUND);
    }
}