import { THEME_HAS_QUESTIONS } from "../common/error-codes";

export class ThemeHasQuestionsError extends Error {
    constructor() {
        super(THEME_HAS_QUESTIONS);
    }
}