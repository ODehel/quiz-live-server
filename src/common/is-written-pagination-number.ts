const WRITTEN_PAGINATION_NUMBER = /^[1-9][0-9]*$/;

export function isWrittenPaginationNumber(value: unknown): boolean {
    return WRITTEN_PAGINATION_NUMBER.test(String(value));
}
