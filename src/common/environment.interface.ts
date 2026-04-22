export interface Environment {
  port: number;
  sqliteDbPath: string;
  playerPassword: string;
  adminPassword: string;
  jwtSecretKey: string;
  jwtExpirationTime: number;
  maxRequestsPerMinute: number;
}