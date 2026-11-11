const DIGITS_ONLY = /^[0-9]+$/;
const MINIMUM_COST = 4;
const MAXIMUM_COST = 31;
const DEFAULT_COST = 12;

export function readBcryptCost(raw: string | undefined): number {
    if (raw === undefined || raw === "") {
        return DEFAULT_COST;
    }
    const cost = Number(raw);
    if (!DIGITS_ONLY.test(raw) || cost < MINIMUM_COST || cost > MAXIMUM_COST) {
        throw new Error("BCRYPT_COST must be an integer between 4 and 31.");
    }
    return cost;
}
