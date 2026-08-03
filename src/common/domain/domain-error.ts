type DomainErrorDetails = Record<string, unknown> | string[] | string;

interface DomainErrorOptions {
  code?: string;
  statusCode?: number;
  details?: DomainErrorDetails;
}

const DomainErrorStatus = {
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
} as const;

abstract class DomainError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details?: DomainErrorDetails;

  protected constructor(message: string, options: DomainErrorOptions = {}) {
    super(message);
    this.name = new.target.name;
    this.code = options.code ?? new.target.name;
    this.statusCode = options.statusCode ?? DomainErrorStatus.BAD_REQUEST;
    this.details = options.details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export { DomainError, DomainErrorDetails, DomainErrorOptions, DomainErrorStatus };
