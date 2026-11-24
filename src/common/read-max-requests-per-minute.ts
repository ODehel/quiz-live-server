import { readDigitsOnlyInteger } from "./read-digits-only-integer";

const DEFAULT_MAX_REQUESTS_PER_MINUTE = "100";
const LOWEST_MAX_REQUESTS_PER_MINUTE = 1;
const HIGHEST_MAX_REQUESTS_PER_MINUTE = 2147483647;

export function readMaxRequestsPerMinute(source: Record<string, string | undefined>): number {
    const maxRequestsPerMinute = readDigitsOnlyInteger(source.MAX_REQUESTS_PER_MINUTE ?? DEFAULT_MAX_REQUESTS_PER_MINUTE);
    if (maxRequestsPerMinute === undefined || maxRequestsPerMinute < LOWEST_MAX_REQUESTS_PER_MINUTE || maxRequestsPerMinute > HIGHEST_MAX_REQUESTS_PER_MINUTE) {
        throw new Error(`MAX_REQUESTS_PER_MINUTE must be an integer between ${LOWEST_MAX_REQUESTS_PER_MINUTE} and ${HIGHEST_MAX_REQUESTS_PER_MINUTE}, written with digits only.`);
    }
    return maxRequestsPerMinute;
}
