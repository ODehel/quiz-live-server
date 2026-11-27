import { readDigitsOnlyInteger } from "./read-digits-only-integer";

export function readBoundedInteger(raw: string, lowest: number, highest: number, refusal: string): number {
    const value = readDigitsOnlyInteger(raw);
    if (value === undefined || value < lowest || value > highest) {
        throw new Error(refusal);
    }
    return value;
}
