interface PaginationQuery {
  page?: number;
  limit?: number;
}

interface PaginationResult {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

export const paginateInMemory = <T>(
  docs: T[],
  query: PaginationQuery,
): { docs: T[]; pagination: PaginationResult } => {
  const page = query.page || 1;
  const limit = query.limit || 10;
  const totalCount = docs.length;
  const start = (page - 1) * limit;

  return {
    docs: docs.slice(start, start + limit),
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
    },
  };
};
