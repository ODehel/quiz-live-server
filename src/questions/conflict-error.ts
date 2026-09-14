import { CONFLICT_ERROR } from "../common/error-codes";

export class ConflictError extends Error {
    constructor() {
        super(CONFLICT_ERROR);
    }
}