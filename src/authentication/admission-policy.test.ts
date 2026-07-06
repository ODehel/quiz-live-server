import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthOutcome, AdmissionPolicy } from "./admission-policy"
import { TokenValidator } from "./token-validator.interface";

describe("Admission Policy", () => 
{
    let tokenValidator: TokenValidator;
    let admissionPolicy: AdmissionPolicy;

    beforeEach(() => {
        tokenValidator = {
            validateToken: vi.fn().mockReturnValue(true)
        }
        admissionPolicy = new AdmissionPolicy(tokenValidator);
    });

    it("admits a connection with a valid token", () => {
        const result = admissionPolicy.evaluate("any-token");
        expect(result).toBe(AuthOutcome.Success);
    });

    it("rejects a connection with an invalid token", () => {
        vi.mocked(tokenValidator.validateToken).mockReturnValue(false);
        const result = admissionPolicy.evaluate("wrong-token");
        expect(result).toBe(AuthOutcome.Rejected);
    });
});