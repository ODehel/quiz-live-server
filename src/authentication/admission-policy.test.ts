import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthOutcome, AdmissionPolicy } from "./admission-policy"
import { TokenValidator } from "./token-validator.interface";
import { Participant } from "./participant.interface";
import { ParticipantResolver } from "./participant-resolver.interface"
import { SubjectExtractor } from "./subject-extractor.interface";

describe("Admission Policy", () => {
    let tokenValidator: TokenValidator;
    let participantResolver: ParticipantResolver;
    let subjectExtractor: SubjectExtractor;
    let admissionPolicy: AdmissionPolicy;

    beforeEach(() => {
        tokenValidator = {
            validateToken: vi.fn().mockReturnValue(true)
        };
        participantResolver = {
            resolve: vi.fn()
        };
        subjectExtractor = {
            extract: vi.fn().mockReturnValue("any-sub")
        };
        admissionPolicy = new AdmissionPolicy(tokenValidator, participantResolver, subjectExtractor);
    });

    it("admits a connection with a valid token", () => {
        const result = admissionPolicy.evaluate("any-token");
        expect(result.authOutcome).toBe(AuthOutcome.Success);
    });

    it("rejects a connection with an invalid token", () => {
        vi.mocked(tokenValidator.validateToken).mockReturnValue(false);
        const result = admissionPolicy.evaluate("wrong-token");
        expect(result.authOutcome).toBe(AuthOutcome.Rejected);
    });

    it("rejects a connection with an unknown participant", () => {
        vi.mocked(participantResolver.resolve).mockReturnValue(null);
        const result = admissionPolicy.evaluate("any-token");
        expect(result.authOutcome).toBe(AuthOutcome.Rejected);
    });

    it("resolves the participant using the extracted subject", () => {
        admissionPolicy.evaluate("any-token");
        expect(participantResolver.resolve).toHaveBeenCalledWith("any-sub");
    });

    it('carries the resolved participant when the connection is admitted', () => {
        const participant: Participant = {};
        vi.mocked(participantResolver.resolve).mockReturnValue(participant);

        const result = admissionPolicy.evaluate('any-token');

        expect(result.participant).toBe(participant);
    });
});