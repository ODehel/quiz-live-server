export interface Pagination<T> {
    data: T[];
    page: number;
    limit: number;
    total: number;
    total_pages: number;
}