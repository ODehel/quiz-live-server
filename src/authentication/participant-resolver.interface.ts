export interface ParticipantResolver {
    exists(sub: string): boolean;
}