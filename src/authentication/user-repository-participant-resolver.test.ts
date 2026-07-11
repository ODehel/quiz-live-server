import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRepository } from "../users/user-repository.interface";
import { UserRole } from "../users/user-role";
import { User } from "../users/user.interface";
import { UserRepositoryParticipantResolver } from "./user-repository-participant-resolver";

describe("User repository participant resolver", () => {
    let userRepository: UserRepository;
    let resolver: UserRepositoryParticipantResolver;

    beforeEach(() => {
        userRepository = {
            retrieveById: vi.fn()
        } as unknown as UserRepository;
        resolver = new UserRepositoryParticipantResolver(userRepository);
    });
    
    it("resolves a participant carrying the id of the user found for the subject", async () => {
        const knownUser: User = { id: "1", username: "testuser", password: "hashed", role: UserRole.PLAYER };
        vi.mocked(userRepository.retrieveById).mockResolvedValue(knownUser);

        const participant = await resolver.resolve(knownUser.id);
        
        expect(participant?.id).toBe(knownUser.id);
    });

    it("can't resolve a participant when the user is unknown", async () => {
        vi.mocked(userRepository.retrieveById).mockResolvedValue(undefined);

        const participant = await resolver.resolve("unknown-id");

        expect(participant).toBeNull();
    });
});