export interface Environment {
  port: number;
  sqliteDbPath: string;
  jwtSecretKey: string;
  jwtExpirationTime: number;
  maxRequestsPerMinute: number;
  seedPasswordFor(login: string): string | undefined;
}
