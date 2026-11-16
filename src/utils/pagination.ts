import { z } from "zod";
import { ApiError } from "./apiError";

export type PaginationQuery = {
  page: number;
  limit: number;
  offset: number;
};

export type PaginationMeta = {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
};

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

/** Parse ?page=1&limit=10 → page 1 has items 1–10 */
export function parsePagination(query: unknown): PaginationQuery {
  const result = paginationSchema.safeParse(query ?? {});
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new ApiError(400, issue?.message ?? "Invalid pagination query");
  }

  const { page, limit } = result.data;
  return { page, limit, offset: (page - 1) * limit };
}

export function paginationMeta(totalCount: number, q: PaginationQuery): PaginationMeta {
  return {
    page: q.page,
    limit: q.limit,
    totalCount,
    totalPages: totalCount === 0 ? 0 : Math.ceil(totalCount / q.limit),
  };
}
