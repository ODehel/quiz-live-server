import { UserRepository } from "../users/user-repository.interface";
import { Participant } from "./participant.interface";

export class UserRepositoryParticipantResolver {
    constructor(private readonly userRepository: UserRepository) {

    }

    async resolve(id: string): Promise<Participant | null> {
        const user = await this.userRepository.retrieveById(id);
        return user ? { id: user.id } : null;
    }
}