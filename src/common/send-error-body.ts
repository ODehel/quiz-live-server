import { FastifyReply } from "fastify";

export interface ErrorBody {
    status: number;
    error: string;
    message?: string;
}

export function sendErrorBody(reply: FastifyReply, body: ErrorBody) {
    reply.status(body.status).send(body);
}
