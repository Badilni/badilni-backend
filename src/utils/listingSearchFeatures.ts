import { Model, PipelineStage, Types } from 'mongoose';

type DiscriminatorType = 'SkillListing' | 'ServiceRequest';

interface PaginationResult {
  page: number;
  limit: number;
  totalCount?: number;
  totalPages?: number;
}

export interface ListingSearchResult<T> {
  docs: T[];
  pagination: PaginationResult;
}

const comparisonOperators = new Set(['lt', 'lte', 'gt', 'gte']);

const rewriteComparisonOperators = (value: unknown): unknown => {
  if (value instanceof Date) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => rewriteComparisonOperators(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        comparisonOperators.has(key) ? `$${key}` : key,
        rewriteComparisonOperators(item),
      ]),
    );
  }

  return value;
};

export class ListingSearchFeatures<T = unknown> {
  private pipeline: PipelineStage[] = [];
  private paginationResult!: PaginationResult;
  private isRelevanceSearch = false;
  private hasStringId = false;

  constructor(
    private model: Model<unknown>,
    private queryString: Record<string, unknown>,
    private discriminatorType: DiscriminatorType,
    private searchFields: string[] = ['title', 'description', 'tags'],
  ) {}

  atlasSearch(): this {
    const keyword =
      typeof this.queryString.keyword === 'string'
        ? this.queryString.keyword
        : '';

    if (keyword) {
      this.isRelevanceSearch = true;
      this.pipeline.push({
        $search: {
          index: 'listings_search',
          compound: {
            should: this.searchFields.map((path) => ({
              text: {
                query: keyword,
                path,
                fuzzy: { maxEdits: 2, prefixLength: 1 },
              },
            })),
          },
        },
      });
      this.pipeline.push({ $addFields: { score: { $meta: 'searchScore' } } });
    }

    return this;
  }

  vectorSearch(vector: number[], numCandidates = 150, limit = 15): this {
    if (typeof this.queryString.smartSearch === 'string') {
      this.isRelevanceSearch = true;
      this.pipeline.push({
        $vectorSearch: {
          index: 'listings_vector',
          path: 'embedding',
          queryVector: vector,
          numCandidates,
          limit,
        },
      });
      this.pipeline.push({
        $addFields: { score: { $meta: 'vectorSearchScore' } },
      });
    }

    return this;
  }

  matchType(): this {
    this.pipeline.push({ $match: { type: this.discriminatorType } });
    return this;
  }

  excludeUser(userId: string): this {
    this.pipeline.push({
      $match: { user: { $ne: new Types.ObjectId(String(userId)) } },
    });
    return this;
  }

  private addStringId(): this {
    if (!this.hasStringId) {
      this.pipeline.push({ $addFields: { id: { $toString: '$_id' } } });
      this.hasStringId = true;
    }

    return this;
  }

  filter(): this {
    const excluded = [
      'sort',
      'limit',
      'page',
      'fields',
      'keyword',
      'smartSearch',
    ];
    const queryObj: Record<string, unknown> = { ...this.queryString };
    excluded.forEach((field) => delete queryObj[field]);

    const rewritten = rewriteComparisonOperators(queryObj) as Record<
      string,
      unknown
    >;

    for (const field of ['category', 'user']) {
      if (rewritten[field]) {
        rewritten[field] = new Types.ObjectId(String(rewritten[field]));
      }
    }

    if (Object.keys(rewritten).length > 0) {
      this.pipeline.push({ $match: rewritten });
    }

    return this;
  }

  lookupUserRelation(): this {
    this.addStringId();

    this.pipeline.push(
      {
        $lookup: {
          from: 'users',
          let: { userId: '$user' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$userId'] } } },
            { $project: { name: 1, avatar: 1 } },
          ],
          as: 'user',
        },
      },
      { $unwind: '$user' },
    );

    return this;
  }

  lookupCategoryRelation(): this {
    this.addStringId();

    this.pipeline.push(
      {
        $lookup: {
          from: 'categories',
          let: { categoryId: '$category' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$categoryId'] } } },
            { $project: { name: 1, slug: 1 } },
          ],
          as: 'category',
        },
      },
      { $unwind: '$category' },
    );

    return this;
  }

  sort(): this {
    const sort =
      typeof this.queryString.sort === 'string' ? this.queryString.sort : '';

    if (sort) {
      const sortSpec: Record<string, 1 | -1> = {};
      sort.split(',').forEach((field) => {
        sortSpec[field.replace('-', '')] = field.startsWith('-') ? -1 : 1;
      });
      this.pipeline.push({ $sort: sortSpec });
    } else if (this.isRelevanceSearch) {
      this.pipeline.push({ $sort: { score: -1 } });
    } else {
      this.pipeline.push({ $sort: { createdAt: -1 } });
    }

    return this;
  }

  limitFields(): this {
    const fields =
      typeof this.queryString.fields === 'string'
        ? this.queryString.fields
        : '';

    if (fields) {
      const included: Record<string, 1> = { id: 1 };
      fields
        .split(',')
        .filter((field) => !['embedding', '__v'].includes(field))
        .forEach((field) => {
          included[field] = 1;
        });

      this.pipeline.push({ $project: included });
    } else {
      this.pipeline.push({ $project: { embedding: 0, __v: 0 } });
    }

    return this;
  }

  paginate(): this {
    const page = Number(this.queryString.page) || 1;
    const limit = Number(this.queryString.limit) || 10;
    this.paginationResult = { page, limit };

    this.pipeline.push({
      $facet: {
        docs: [{ $skip: (page - 1) * limit }, { $limit: limit }],
        totalCount: [{ $count: 'count' }],
      },
    });

    return this;
  }

  async exec(): Promise<ListingSearchResult<T>> {
    const [result] = await this.model.aggregate(this.pipeline);
    const docs = result?.docs ?? [];
    const totalCount = result?.totalCount?.[0]?.count ?? 0;

    return {
      docs,
      pagination: {
        ...this.paginationResult,
        totalCount,
        totalPages: Math.ceil(totalCount / this.paginationResult.limit),
      },
    };
  }

  async execCandidates(): Promise<T[]> {
    return this.model.aggregate(this.pipeline);
  }
}
