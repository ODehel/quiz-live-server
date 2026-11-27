import { readBoundedInteger } from "./read-bounded-integer";

const DEFAULT_MAX_REQUESTS_PER_MINUTE = "100";
const LOWEST_MAX_REQUESTS_PER_MINUTE = 1;
const HIGHEST_MAX_REQUESTS_PER_MINUTE = 2147483647;

export function readMaxRequestsPerMinute(source: Record<string, string | undefined>): number {
    return readBoundedInteger(source.MAX_REQUESTS_PER_MINUTE ?? DEFAULT_MAX_REQUESTS_PER_MINUTE, LOWEST_MAX_REQUESTS_PER_MINUTE, HIGHEST_MAX_REQUESTS_PER_MINUTE, `MAX_REQUESTS_PER_MINUTE must be an integer between ${LOWEST_MAX_REQUESTS_PER_MINUTE} and ${HIGHEST_MAX_REQUESTS_PER_MINUTE}, written with digits only.`);
}
