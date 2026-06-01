import { AppError } from './appError.js';

export interface ValidationIssue {
  path: string;
  message: string;
  code?: string;
}

export class ValidationError extends AppError {
  errors: ValidationIssue[];

  constructor(errors: ValidationIssue[]) {
    super('Validation failed', 400);
    this.errors = errors;
    Object.setPrototypeOf(this, ValidationError.prototype);
  }

  override serialize() {
    return {
      status: this.status,
      message: this.message,
      errors: this.errors,
    };
  }
}
