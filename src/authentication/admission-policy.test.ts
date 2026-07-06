import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthOutcome, AdmissionPolicy } from "./admission-policy"
import { TokenValidator } from "./token-validator.interface";
import { ParticipantResolver } from "./participant-resolver.interface"

describe("Admission Policy", () => 
{
    let tokenValidator: TokenValidator;
    let participantResolver: ParticipantResolver;
    let admissionPolicy: AdmissionPolicy;

    beforeEach(() => {
        tokenValidator = {
            validateToken: vi.fn().mockReturnValue(true)
        };
        participantResolver = {
            exists: vi.fn().mockReturnValue(true)
        };
        admissionPolicy = new AdmissionPolicy(tokenValidator, participantResolver);
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

    it("rejects a connection with an unknown participant", () => {
        vi.mocked(participantResolver.exists).mockReturnValue(false);
        const result = admissionPolicy.evaluate("any-token");
        expect(result).toBe(AuthOutcome.Rejected);
    });
});