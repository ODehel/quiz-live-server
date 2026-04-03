import { Clock } from "./infrastructure/Clock";
import { Network } from "./infrastructure/Network";
import { IQuizServerConfiguration } from "./IQuizServerConfiguration";
import { QuizServer } from "./QuizServer";

const quizServerConfiguration : IQuizServerConfiguration = {
    clock: new Clock(),
    network: new Network(),
    port: process.env.PORT ? parseInt(process.env.PORT) : 3000
}
const server : QuizServer = new QuizServer(quizServerConfiguration)
server.start()