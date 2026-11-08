export class UnknownFieldsError extends Error {
    constructor(public readonly fields: string[]) {
        super(`Unknown field(s): ${fields.join(', ')}.`);
    }
}
