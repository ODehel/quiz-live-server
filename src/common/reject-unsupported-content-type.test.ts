import { errorCodes, FastifyReply, FastifyRequest } from "fastify";
import { describe, expect, it } from "vitest";
import { rejectUnsupportedContentType } from "./reject-unsupported-content-type";

function verdictOn(contentType: string | undefined): "accepted" | "refused" {
    let outcome: Error | undefined;
    const request = { headers: contentType === undefined ? {} : { "content-type": contentType } } as FastifyRequest;
    rejectUnsupportedContentType(request, {} as FastifyReply, (error) => { outcome = error; });
    if (outcome === undefined) return "accepted";
    expect(outcome).toBeInstanceOf(errorCodes.FST_ERR_CTP_INVALID_MEDIA_TYPE);
    return "refused";
}

describe("Decision #89 - only a charset other than utf-8 makes the content type unsupported", () => {
    it.each([
        "application/json",
        "application/json; charset=utf-8",
        "application/json; charset=UTF-8",
        "application/json; CHARSET=utf-8",
        'application/json; charset="utf-8"',
        'application/json; charset="UTF-8"',
        "application/json; charset=utf-8 ; foo=bar",
        "application/json; foo=bar; charset=utf-8",
        "application/json; foo=bar",
    ])("accepts the content type %j", (contentType) => {
        expect(verdictOn(contentType)).toBe("accepted");
    });

    it.each([
        "application/json; xcharset=latin1",
        "application/json; charsetx=latin1",
        "application/json; charsets=latin1",
    ])("ignores the parameter that only looks like a charset in %j", (contentType) => {
        expect(verdictOn(contentType)).toBe("accepted");
    });

    it.each([
        "application/json; charset=latin1",
        "application/json;charset=latin1",
        "application/json;   charset=latin1",
        "application/json; CHARSET=latin1",
        "application/json; foo=bar; charset=latin1",
        "application/json; charset=utf-16",
        "application/json; charset=xutf-8",
        "application/json; charset=utf-8x",
        'application/json; charset="utf-8',
        "application/json; charset==utf-8",
        "application/json; charset=",
        "application/json; charset",
    ])("refuses the content type %j", (contentType) => {
        expect(verdictOn(contentType)).toBe("refused");
    });

    it("refuses a request without content type", () => {
        expect(verdictOn(undefined)).toBe("refused");
    });
});
