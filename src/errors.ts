export class SentiSenseError extends Error {
  status?: number;
  code?: string;

  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = "SentiSenseError";
    this.status = status;
    this.code = code;
  }
}

export class AuthenticationError extends SentiSenseError {
  constructor(message: string, status: number, code?: string) {
    super(message, status, code);
    this.name = "AuthenticationError";
  }
}

export class NotFoundError extends SentiSenseError {
  constructor(message: string, code?: string) {
    super(message, 404, code);
    this.name = "NotFoundError";
  }
}

export class RateLimitError extends SentiSenseError {
  constructor(message: string, code?: string) {
    super(message, 429, code);
    this.name = "RateLimitError";
  }
}

export class APIError extends SentiSenseError {
  constructor(message: string, status: number, code?: string) {
    super(message, status, code);
    this.name = "APIError";
  }
}
