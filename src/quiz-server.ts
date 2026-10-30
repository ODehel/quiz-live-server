import Fastify, { FastifyInstance, InjectOptions, LightMyRequestResponse } from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import { QuizServerConfiguration } from './quiz-server-configuration.interface';
import healthRoute from './routes/health-route';
import wsRoute from './websocket/ws-route';
import tokenRoute from './authentication/token-route';
import themeRoute from './themes/theme-route';
import { TokenRouteConfiguration } from './authentication/token-route-configuration.interface';
import { ThemeRouteConfiguration } from './themes/theme-route-configuration.interface';
import { WsRouteConfiguration } from './websocket/ws-route-configuration.interface';
import { QuestionRouteConfiguration } from './questions/question-route-configuration.interface';
import questionRoute from './questions/question-route';

export class QuizServer {
    private app: FastifyInstance;
    private configuration: QuizServerConfiguration;
    private tokenRouteConfiguration: TokenRouteConfiguration;
    private themeRouteConfiguration: ThemeRouteConfiguration;
    private wsRouteConfiguration: WsRouteConfiguration;
    private questionRouteConfiguration: QuestionRouteConfiguration;

    constructor(configuration: QuizServerConfiguration,
        tokenRouteConfiguration: TokenRouteConfiguration,
        themeRouteConfiguration: ThemeRouteConfiguration,
        wsRouteConfiguration: WsRouteConfiguration,
        questionRouteConfiguration: QuestionRouteConfiguration) {
        this.app = Fastify({ logger: true });
        this.configuration = configuration;
        this.tokenRouteConfiguration = tokenRouteConfiguration;
        this.themeRouteConfiguration = themeRouteConfiguration;
        this.wsRouteConfiguration = wsRouteConfiguration;
        this.questionRouteConfiguration = questionRouteConfiguration;
    }

    async start(): Promise<void> {
        this.registerRoutes();
        await this.app.listen({ port: this.configuration.port, host: '0.0.0.0' });
        console.log("🚀 Server started at " + this.formatDateNow());
        console.log(this.formatMessageWithIpAndPort());
    }

    async inject(options: InjectOptions | string): Promise<LightMyRequestResponse> {
        return await this.app.inject(options);
    }

    async stop(): Promise<void> {
        await this.app.close();
    }

    private registerRoutes() {
        this.app.register(fastifyWebsocket);
        this.app.register(healthRoute);
        this.app.register(wsRoute, this.wsRouteConfiguration);
        this.app.register(tokenRoute, this.tokenRouteConfiguration);
        this.app.register(themeRoute, this.themeRouteConfiguration);
        this.app.register(questionRoute, this.questionRouteConfiguration);
    }

    private formatDateNow() {
        const date = this.configuration.clock.now();
        const hh = date.getHours().toString().padStart(2, '0');
        const mm = date.getMinutes().toString().padStart(2, '0');
        const ss = date.getSeconds().toString().padStart(2, '0');
        const time = `${hh}:${mm}:${ss}`;
        return time;
    }

    private formatMessageWithIpAndPort() {
        const allInterfaces = Object.values(this.configuration.network.networkInterfaces()).flat();
        const firstInterface = allInterfaces.find(iface => iface?.family === 'IPv4' && !iface.internal);
        if (!firstInterface) return `⚠️ No network interface found, listening on http://localhost:${this.configuration.port}`;

        return `📡 Listening on http://${firstInterface.address}:${this.configuration.port}`;
    }
}
