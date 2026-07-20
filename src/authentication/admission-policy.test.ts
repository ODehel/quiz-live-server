import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthOutcome, AdmissionPolicy } from "./admission-policy"
import { TokenValidator } from "./token-validator.interface";
import { Participant } from "./participant.interface";
import { ParticipantResolver } from "./participant-resolver.interface"
import { SubjectExtractor } from "./subject-extractor.interface";
import { UserRole } from "../users/user-role";

describe("Admission Policy", () => {
    let tokenValidator: TokenValidator;
    let participantResolver: ParticipantResolver;
    let subjectExtractor: SubjectExtractor;
    let admissionPolicy: AdmissionPolicy;

    beforeEach(() => {
        tokenValidator = {
            validateToken: vi.fn().mockReturnValue(true),
            inspectToken: vi.fn()
        };
        participantResolver = {
            resolve: vi.fn()
        };
        subjectExtractor = {
            extract: vi.fn().mockReturnValue("any-sub")
        };
        admissionPolicy = new AdmissionPolicy(tokenValidator, participantResolver, subjectExtractor);
    });

    it("admits a connection with a valid token", async () => {
        const result = await admissionPolicy.evaluate("any-token");
        expect(result.authOutcome).toBe(AuthOutcome.Success);
    });

    it("rejects a connection with an invalid token", async () => {
        vi.mocked(tokenValidator.validateToken).mockReturnValue(false);
        const result = await admissionPolicy.evaluate("wrong-token");
        expect(result.authOutcome).toBe(AuthOutcome.Rejected);
    });

    it("rejects a connection with an unknown participant", async () => {
        vi.mocked(participantResolver.resolve).mockResolvedValue(null);
        const result = await admissionPolicy.evaluate("any-token");
        expect(result.authOutcome).toBe(AuthOutcome.Rejected);
    });

    it("resolves the participant using the extracted subject", async () => {
        await admissionPolicy.evaluate("any-token");
        expect(participantResolver.resolve).toHaveBeenCalledWith("any-sub");
    });

    it('carries the resolved participant when the connection is admitted', async () => {
        const participant: Participant = { id: "any-id", username: "any-username", role: UserRole.ADMIN };
        vi.mocked(participantResolver.resolve).mockResolvedValue(participant);

        const result = await admissionPolicy.evaluate('any-token');

        expect(result.authOutcome).toBe(AuthOutcome.Success);
        if (result.authOutcome === AuthOutcome.Success)
            expect(result.participant).toBe(participant);
    });
});