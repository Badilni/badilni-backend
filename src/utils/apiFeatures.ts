import { Query } from 'mongoose';

interface PaginationResult {
  page: number;
  limit: number;
  totalCount?: number;
  totalPages?: number;
}

export class APIFeatures<T = any> {
  paginationResult!: PaginationResult;
  countQuery!: Query<number, any>;
  docs?: T[];

  constructor(
    public query: Query<T[], any>,
    public queryString: Record<string, any>,
    public searchFields: string[] = ['name'],
  ) {}

  filter(): this {
    const queryObj = { ...this.queryString };
    const excludedFields = ['sort', 'limit', 'page', 'fields', 'keyword'];
    excludedFields.forEach((field) => delete queryObj[field]);

    this.query = this.query.find(queryObj);
    return this;
  }

  search(): this {
    if (this.queryString.keyword) {
      const regex = { $regex: this.queryString.keyword, $options: 'i' };
      const searchQuery = {
        $or: this.searchFields.map((field) => ({ [field]: regex })),
      };
      this.query = this.query.find(searchQuery);
    }

    return this;
  }

  sort(): this {
    if (this.queryString.sort) {
      const sortFields = this.queryString.sort.split(',').join(' ');
      this.query = this.query.sort(sortFields);
    } else {
      this.query = this.query.sort('-createdAt');
    }
    return this;
  }

  limitFields(): this {
    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(',').join(' ');
      this.query = this.query.select(fields);
    } else {
      this.query = this.query.select('-__v');
    }
    return this;
  }

  paginate(): this {
    const page = +this.queryString.page || 1;
    const limit = +this.queryString.limit || 10;
    const skip = (page - 1) * limit;

    this.paginationResult = { page, limit };
    this.countQuery = this.query.clone().countDocuments();
    this.query = this.query.skip(skip).limit(limit);

    return this;
  }

  async exec(): Promise<this> {
    const [totalCount, docs] = await Promise.all([this.countQuery, this.query]);

    this.paginationResult = {
      ...this.paginationResult,
      totalCount,
      totalPages: Math.ceil(totalCount / this.paginationResult.limit),
    };

    this.docs = docs;

    return this;
  }
}
