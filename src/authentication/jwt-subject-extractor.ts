import { SubjectExtractor } from "./subject-extractor.interface";
import jwt from "jsonwebtoken";

export class JwtSubjectExtractor implements SubjectExtractor {
    extract(token: string): string {
        const subjectPayLoad: SubjectPayload = jwt.decode(token) as SubjectPayload;
        return subjectPayLoad.sub;
    }
}

interface SubjectPayload extends jwt.JwtPayload {
    sub: string;
}