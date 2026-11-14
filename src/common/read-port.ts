import { readDigitsOnlyInteger } from "./read-digits-only-integer";

const DEFAULT_PORT = "3000";
const LOWEST_PORT = 1;
const HIGHEST_PORT = 65535;

export function readPort(source: Record<string, string | undefined>): number {
    const port = readDigitsOnlyInteger(source.PORT ?? DEFAULT_PORT);
    if (port === undefined || port < LOWEST_PORT || port > HIGHEST_PORT) {
        throw new Error(`PORT must be an integer between ${LOWEST_PORT} and ${HIGHEST_PORT}.`);
    }
    return port;
}
