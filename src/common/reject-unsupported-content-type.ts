import { errorCodes, FastifyReply, FastifyRequest, HookHandlerDoneFunction } from "fastify";

const CHARSET_PARAMETER = /^\s*charset\s*(=|$)/i;
const UTF_8 = /^(?:utf-8|"utf-8")$/i;

// What follows the first "=" of a parameter, or the whole parameter when it has none.
const valueOf = (parameter: string) => parameter.slice(parameter.indexOf('=') + 1).trim();

const declaresAnotherCharset = (contentType: string) => {
    const charset = contentType.split(';').find(parameter => CHARSET_PARAMETER.test(parameter));
    return charset !== undefined && !UTF_8.test(valueOf(charset));
};

export function rejectUnsupportedContentType(request: FastifyRequest, _reply: FastifyReply, done: HookHandlerDoneFunction) {
    const contentType = request.headers['content-type'];
    if (!contentType || declaresAnotherCharset(contentType)) {
        return done(new errorCodes.FST_ERR_CTP_INVALID_MEDIA_TYPE());
    }
    done();
}
