import { Pagination } from "./pagination.interface";

export function buildPagination<T>(data: T[], page: number, limit: number, total: number): Pagination<T> {
    return {
        data: data,
        limit: limit,
        page: page,
        total: total,
        total_pages: Math.ceil(total / limit)
    };
}
