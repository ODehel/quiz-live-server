export interface Environment {
  port: number;
  sqliteDbPath: string;
  maxRequestsPerMinute: number;
  seedPasswordFor(login: string): string | undefined;
  bcryptCost(): string | undefined;
}
