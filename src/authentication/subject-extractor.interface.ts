export interface SubjectExtractor {
    extract(token: string): string;
}