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

const processEnvironment: ProcessEnvironment = new ProcessEnvironment();

const quizServerConfiguration : QuizServerConfiguration = {
    clock: new SystemClock(),
    network: new OsNetwork(),
    port: processEnvironment.port
};

const userRepository = new SqliteUserRepository(processEnvironment.sqliteDbPath);
const hasher = new BcryptHasher();
const tokenRouteConfiguration: TokenRouteConfiguration = {
    authenticationService: new JwtAuthenticationService(userRepository, hasher),
    tokenGenerator: new JwtGenerator(processEnvironment.jwtSecretKey, processEnvironment.jwtExpirationTime),
    maxRequestsPerMinute: processEnvironment.maxRequestsPerMinute
};
const themeRouteConfiguration: ThemeRouteConfiguration = {
    themeService: new DefaultThemeService(new SystemClock(), new Uuidv7Generator(), new SqliteThemeRepository(processEnvironment.sqliteDbPath)),
    uuidValidator: new Uuidv7Validator(),
    tokenValidator: new JwtValidator(processEnvironment.jwtSecretKey),
    middleware: authenticationMiddleware
};
const server : QuizServer = new QuizServer(quizServerConfiguration, tokenRouteConfiguration, themeRouteConfiguration);
server.start();