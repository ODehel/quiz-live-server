const DIGITS_ONLY = /^[0-9]+$/;

export function readDigitsOnlyInteger(raw: string): number | undefined {
    if (!DIGITS_ONLY.test(raw)) {
        return undefined;
    }
    return Number(raw);
}
