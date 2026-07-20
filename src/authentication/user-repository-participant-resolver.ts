import { UserRepository } from "../users/user-repository.interface";
import { ParticipantResolver } from "./participant-resolver.interface";
import { Participant } from "./participant.interface";

export class UserRepositoryParticipantResolver implements ParticipantResolver {
    constructor(private readonly userRepository: UserRepository) {

    }

    async resolve(id: string): Promise<Participant | null> {
        const user = await this.userRepository.retrieveById(id);
        return user ? { id: user.id, username: user.username, role: user.role } : null;
    }
}