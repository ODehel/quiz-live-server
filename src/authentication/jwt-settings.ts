export interface JwtSettings {
    secret: string;
    expiration: number;
}

const MINIMUM_SECRET_LENGTH = 32;
const DEFAULT_EXPIRATION = "3600";
const DIGITS_ONLY = /^[0-9]+$/;

export function readJwtSettings(source: Record<string, string | undefined>): JwtSettings {
    const secret = source.JWT_SECRET;
    if (secret === undefined || secret.length < MINIMUM_SECRET_LENGTH) {
        throw new Error(`JWT_SECRET is required and must contain at least ${MINIMUM_SECRET_LENGTH} characters.`);
    }
    const expiration = source.JWT_EXPIRATION || DEFAULT_EXPIRATION;
    if (!DIGITS_ONLY.test(expiration) || Number(expiration) === 0) {
        throw new Error("JWT_EXPIRATION must be a strictly positive integer, in seconds.");
    }
    return { secret: secret, expiration: Number(expiration) };
}
