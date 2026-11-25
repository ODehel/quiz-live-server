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
import { UuidFormatValidator } from './infrastructure/uuid-format-validator';
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
import { JwtSettings, readJwtSettings } from './authentication/jwt-settings';
import { readPort } from './common/read-port';
import { readMaxRequestsPerMinute } from './common/read-max-requests-per-minute';

function exitWithStartupFailure(error: unknown): never {
    console.error("Server starting failed: " + (error instanceof Error ? error.message : String(error)));
    process.exit(1);
}

// Every check and every use of the database happens here, in the order of US-003/CA-21 (JWT_*, PORT, MAX_REQUESTS_PER_MINUTE, SQLITE_DB_PATH, then the database),
// so that a single failure, whichever the step, leaves through exitWithStartupFailure. The first statement addressed to the database
// is the creation of a table in a repository constructor: an error of a file that is not a SQLite database comes from there.
function createServer(): QuizServer {
    const jwtSettings: JwtSettings = readJwtSettings(process.env);
    const port: number = readPort(process.env);
    const maxRequestsPerMinute: number = readMaxRequestsPerMinute(process.env);
    const processEnvironment: ProcessEnvironment = new ProcessEnvironment();
    const database = new Database(processEnvironment.sqliteDbPath);
    const userRepository = new SqliteUserRepository(database);
    const themeRepository = new SqliteThemeRepository(database);
    const questionRepository = new SqliteQuestionRepository(database);
    const clock = new SystemClock();

    const quizServerConfiguration: QuizServerConfiguration = {
        clock: clock,
        network: new OsNetwork(),
        port: port,
        rateLimitMiddleware: async (app) => { await rateLimitMiddleware(app, { maxRequestsPerMinute }) }
    };

    const hasher = new BcryptHasher();
    const tokenRouteConfiguration: TokenRouteConfiguration = {
        authenticationService: new JwtAuthenticationService(userRepository, hasher),
        tokenGenerator: new JwtGenerator(jwtSettings.secret, jwtSettings.expiration)
    };
    const themeRouteConfiguration: ThemeRouteConfiguration = {
        themeService: new DefaultThemeService(clock, new Uuidv7Generator(), themeRepository),
        uuidValidator: new Uuidv7Validator(),
        tokenValidator: new JwtValidator(jwtSettings.secret),
        tokenDecoder: new JwtDecoder(),
        middleware: authenticationMiddleware
    };
    const wsRouteConfiguration: WsRouteConfiguration = {
        tokenValidator: new JwtValidator(jwtSettings.secret),
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
        tokenValidator: new JwtValidator(jwtSettings.secret),
        questionService: new DefaultQuestionService(clock, new Uuidv7Generator(), questionRepository, new ThemeRepositoryExistenceChecker(themeRepository), new UuidFormatValidator()),
        middleware: authenticationMiddleware
    };
    return new QuizServer(quizServerConfiguration, tokenRouteConfiguration, themeRouteConfiguration, wsRouteConfiguration, questionRouteConfiguration);
}

let server: QuizServer;
try {
    server = createServer();
} catch (error: unknown) {
    exitWithStartupFailure(error);
}
server.start().catch(exitWithStartupFailure);
