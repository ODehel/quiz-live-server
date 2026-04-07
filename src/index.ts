import 'dotenv/config';
import { JwtAuthenticationService } from "./authentication/jwt-authentication-service";
import { JwtTokenGenerator } from "./authentication/jwt-token-generator";
import { BcryptHasher } from "./infrastructure/BcryptHasher";
import { Clock } from "./infrastructure/Clock";
import { Network } from "./infrastructure/Network";
import { SqliteUserRepository } from "./infrastructure/SqliteUserRepository";
import { QuizServerConfiguration } from "./quiz-server-configuration.interface";
import { QuizServer } from "./quiz-server";

const quizServerConfiguration : QuizServerConfiguration = {
    clock: new Clock(),
    network: new Network(),
    port: process.env.PORT ? parseInt(process.env.PORT) : 3000
};

const userRepository = new SqliteUserRepository(process.env.SQLITE_DB_PATH || 'quiz.db');
const hasher = new BcryptHasher();
const authenticationService = new JwtAuthenticationService(userRepository, hasher);
const tokenGenerator = new JwtTokenGenerator(process.env.JWT_SECRET_KEY || 'MySecretKey', process.env.JWT_EXPIRATION_TIME ? parseInt(process.env.JWT_EXPIRATION_TIME) : 3600);

const server : QuizServer = new QuizServer(quizServerConfiguration, authenticationService, tokenGenerator, process.env.MAX_REQUESTS_PER_MINUTE ? parseInt(process.env.MAX_REQUESTS_PER_MINUTE) : 100);
server.start();