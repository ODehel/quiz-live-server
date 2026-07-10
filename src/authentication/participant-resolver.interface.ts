import { Participant } from "./participant.interface";

export interface ParticipantResolver {
    resolve(sub: string): Promise<Participant | null>;
}