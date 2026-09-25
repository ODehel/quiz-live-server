import 'dotenv/config';
import { JwtAuthenticationService } from "./authentication/jwt-authentication-service";
import { JwtGenerator } from "./authentication/jwt-generator";
import { BcryptHasher } from "./infrastructure/bcrypt-hasher";
import { SystemClock } from "./infrastructure/system-clock";
import { OsNetwork } from "./infrastructure/os-network";
import { SqliteUserRepository } from "./users/sqlite-user-repository";
import { QuizServerConfiguration } from "./quiz-server-configuration.interface";
import { QuizServer } from "./quiz-server";
import { TokenRouteConfiguration } from './authentication/token-route-configuration.interface';
import { ThemeRouteConfiguration } from './themes/theme-route-configuration.interface';
import { DefaultThemeService } from './themes/default-theme-service';
import { Uuidv7Generator } from './infrastructure/uuidv7-generator';
import { SqliteThemeRepository } from './themes/sqlite-theme-repository';
import { Uuidv7Validator } from './infrastructure/uuidv7-validator';
import { JwtValidator } from './authentication/jwt-validator';
import authenticationMiddleware from './authentication/authentication-middleware';
import { ProcessEnvironment } from './common/process-environment';
import { JwtDecoder } from './authentication/jwt-decoder';
import rateLimitMiddleware from './infrastructure/rate-limit-middleware';
import { WsRouteConfiguration } from './websocket/ws-route-configuration.interface';
import { SystemScheduler } from './infrastructure/system-scheduler';
import { JwtSubjectExtractor } from './authentication/jwt-subject-extractor';
import { UserRepositoryParticipantResolver } from './authentication/user-repository-participant-resolver';
import { JwtExpirationExtractor } from './authentication/jwt-expiration-extractor';
import { PinoWsEventReporter } from './websocket/pino-ws-event-reporter';
import pino from 'pino';
import { WsConnectionPolicy } from './websocket/ws-connection-policy';
import { QuestionRouteConfiguration } from './questions/question-route-configuration.interface';
import { DefaultQuestionService } from './questions/default-question-service';
import { ThemeRepositoryExistenceChecker } from './questions/theme-repository-existence-checker';
import { SqliteQuestionRepository } from './questions/sqlite-question-repository';
import Database from 'better-sqlite3';

const clock = new SystemClock();

const processEnvironment: ProcessEnvironment = new ProcessEnvironment();

const database = new Database(processEnvironment.sqliteDbPath);
const quizServerConfiguration: QuizServerConfiguration = {
    clock: clock,
    network: new OsNetwork(),
    port: processEnvironment.port
};

const userRepository = new SqliteUserRepository(database);
const themeRepository = new SqliteThemeRepository(database);
const hasher = new BcryptHasher();
const tokenRouteConfiguration: TokenRouteConfiguration = {
    authenticationService: new JwtAuthenticationService(userRepository, hasher),
    tokenGenerator: new JwtGenerator(processEnvironment.jwtSecretKey, processEnvironment.jwtExpirationTime),
    rateLimitMiddleware: async (app) => { await rateLimitMiddleware(app, { maxRequestsPerMinute: processEnvironment.maxRequestsPerMinute }) }
};
const themeRouteConfiguration: ThemeRouteConfiguration = {
    themeService: new DefaultThemeService(clock, new Uuidv7Generator(), themeRepository),
    uuidValidator: new Uuidv7Validator(),
    tokenValidator: new JwtValidator(processEnvironment.jwtSecretKey),
    tokenDecoder: new JwtDecoder(),
    middleware: authenticationMiddleware,
    rateLimitMiddleware: async (app) => { await rateLimitMiddleware(app, { maxRequestsPerMinute: processEnvironment.maxRequestsPerMinute }) }
};
const wsRouteConfiguration: WsRouteConfiguration = {
    tokenValidator: new JwtValidator(processEnvironment.jwtSecretKey),
    scheduler: new SystemScheduler(),
    subjectExtractor: new JwtSubjectExtractor(),
    participantResolver: new UserRepositoryParticipantResolver(userRepository),
    expirationExtractor: new JwtExpirationExtractor(),
    clock: clock,
    wsEventReporter: new PinoWsEventReporter(pino()),
    wsConnectionPolicy: new WsConnectionPolicy(),
    maxConnections: 10
};
const questionRouteConfiguration: QuestionRouteConfiguration = {
    tokenDecoder: new JwtDecoder(),
    tokenValidator: new JwtValidator(processEnvironment.jwtSecretKey),
    questionService: new DefaultQuestionService(clock, new Uuidv7Generator(), new SqliteQuestionRepository(database), new ThemeRepositoryExistenceChecker(themeRepository)),
    middleware: authenticationMiddleware,
    rateLimitMiddleware: async (app) => { await rateLimitMiddleware(app, { maxRequestsPerMinute: processEnvironment.maxRequestsPerMinute }) }
};
const server: QuizServer = new QuizServer(quizServerConfiguration, tokenRouteConfiguration, themeRouteConfiguration, wsRouteConfiguration, questionRouteConfiguration);
server.start();
