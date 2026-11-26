import { errorCodes, FastifyReply, FastifyRequest, HookHandlerDoneFunction } from "fastify";

const declaredCharset = (contentType: string) => contentType
    .split(';')
    .find(parameter => /^\s*charset\s*(=|$)/i.test(parameter))
    ?.split('=').slice(1).join('=').trim().replace(/^"(.*)"$/, '$1').toLowerCase();

export function rejectUnsupportedContentType(request: FastifyRequest, _reply: FastifyReply, done: HookHandlerDoneFunction) {
    const contentType = request.headers['content-type'];
    if (!contentType) {
        return done(new errorCodes.FST_ERR_CTP_INVALID_MEDIA_TYPE());
    }
    const charset = declaredCharset(contentType);
    if (charset !== undefined && charset !== 'utf-8') {
        return done(new errorCodes.FST_ERR_CTP_INVALID_MEDIA_TYPE());
    }
    done();
}
