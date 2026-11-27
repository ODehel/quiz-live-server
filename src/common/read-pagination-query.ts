import { FastifyReply } from "fastify";
import { INVALID_PAGINATION } from "./error-codes";
import { isWrittenPaginationNumber } from "./is-written-pagination-number";
import { sendErrorBody } from "./send-error-body";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const HIGHEST_LIMIT = 100;

export function readPaginationQuery(query: { page?: string, limit?: string }, reply: FastifyReply): { page: number, limit: number } | undefined {
    const { page = DEFAULT_PAGE, limit = DEFAULT_LIMIT } = query;
    if (!isWrittenPaginationNumber(limit) || Number(limit) > HIGHEST_LIMIT || !isWrittenPaginationNumber(page)) {
        sendErrorBody(reply, { status: 400, error: INVALID_PAGINATION, message: 'Invalid pagination parameters.' });
        return undefined;
    }
    return { page: Number(page), limit: Number(limit) };
}
