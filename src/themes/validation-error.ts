import { VALIDATION_ERROR } from "../common/error-codes";

export class ValidationError extends Error {
    constructor() {
        super(VALIDATION_ERROR);
    }
}

