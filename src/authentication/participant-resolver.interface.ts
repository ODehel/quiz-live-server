import { Participant } from "./participant.interface";

export interface ParticipantResolver {
    resolve(sub: string): Participant | null;
}