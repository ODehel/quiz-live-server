import { readBoundedInteger } from "./read-bounded-integer";

const DEFAULT_PORT = "3000";
const LOWEST_PORT = 1;
const HIGHEST_PORT = 65535;

export function readPort(source: Record<string, string | undefined>): number {
    return readBoundedInteger(source.PORT ?? DEFAULT_PORT, LOWEST_PORT, HIGHEST_PORT, `PORT must be an integer between ${LOWEST_PORT} and ${HIGHEST_PORT}.`);
}
