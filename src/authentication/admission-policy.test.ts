import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthOutcome, AdmissionPolicy } from "./admission-policy"
import { TokenValidator } from "./token-validator.interface";
import { ParticipantResolver } from "./participant-resolver.interface"
import { SubjectExtractor } from "./subject-extractor.interface";

describe("Admission Policy", () => 
{
    let tokenValidator: TokenValidator;
    let participantResolver: ParticipantResolver;
    let subjectExtractor: SubjectExtractor;
    let admissionPolicy: AdmissionPolicy;

    beforeEach(() => {
        tokenValidator = {
            validateToken: vi.fn().mockReturnValue(true)
        };
        participantResolver = {
            exists: vi.fn().mockReturnValue(true)
        };
        subjectExtractor = {
            extract: vi.fn().mockReturnValue("any-sub")
        };
        admissionPolicy = new AdmissionPolicy(tokenValidator, participantResolver, subjectExtractor);
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

    it("resolves the participant using the extracted subject", () => {
        admissionPolicy.evaluate("any-token");
        expect(participantResolver.exists).toHaveBeenCalledWith("any-sub");
    });
});