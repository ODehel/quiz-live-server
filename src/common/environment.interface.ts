export interface Environment {
  sqliteDbPath: string;
  seedPasswordFor(login: string): string | undefined;
  bcryptCost(): string | undefined;
}
