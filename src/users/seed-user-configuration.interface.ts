export interface SeedUserConfiguration {
    seedPasswordFor(login: string): string | undefined;
}
