export interface Environment {
  sqliteDbPath: string;
  maxRequestsPerMinute: number;
  seedPasswordFor(login: string): string | undefined;
  bcryptCost(): string | undefined;
}
