// middleware/validate.ts
import { Request, Response, NextFunction } from 'express';
import { ZodType } from 'zod';

interface ValidateTargets {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
}

export const validate = (schemas: ValidateTargets) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.params) {
        req.params = schemas.params.parse(req.params) as any;
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query) as any;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
};
