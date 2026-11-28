import { Pagination } from "./pagination.interface";

export function paginate<T>(source: { getAll(page: number, limit: number): T[]; count(): number }, page: number, limit: number): Pagination<T> {
    const data: T[] = source.getAll(page, limit);
    const total: number = source.count();
    return {
        data: data,
        limit: limit,
        page: page,
        total: total,
        total_pages: Math.ceil(total / limit)
    };
}
