import 'dotenv/config';
import { AuthenticationService } from "./authentication/AuthenticationService";
import { JwtTokenGenerator } from "./authentication/JwtTokenGenerator";
import { BcryptHasher } from "./infrastructure/BcryptHasher";
import { Clock } from "./infrastructure/Clock";
import { Network } from "./infrastructure/Network";
import { SqliteUserRepository } from "./infrastructure/SqliteUserRepository";
import { IQuizServerConfiguration } from "./IQuizServerConfiguration";
import { QuizServer } from "./QuizServer";

const quizServerConfiguration : IQuizServerConfiguration = {
    clock: new Clock(),
    network: new Network(),
    port: process.env.PORT ? parseInt(process.env.PORT) : 3000
};

const userRepository = new SqliteUserRepository(process.env.SQLITE_DB_PATH || 'quiz.db');
const hasher = new BcryptHasher();
const authenticationService = new AuthenticationService(userRepository, hasher);
const tokenGenerator = new JwtTokenGenerator(process.env.JWT_SECRET_KEY || 'MySecretKey', process.env.JWT_EXPIRATION_TIME ? parseInt(process.env.JWT_EXPIRATION_TIME) : 3600);

const server : QuizServer = new QuizServer(quizServerConfiguration, authenticationService, tokenGenerator, process.env.MAX_REQUESTS_PER_MINUTE ? parseInt(process.env.MAX_REQUESTS_PER_MINUTE) : 100);
server.start();