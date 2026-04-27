import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ZodError } from "zod";

export type ErrorResponse = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export class AppError extends Error {
  public readonly statusCode: ContentfulStatusCode;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: ContentfulStatusCode = 500,
    code = "APP_ERROR",
    details?: unknown
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const formatErrorResponse = (error: AppError): ErrorResponse => ({
  error: {
    code: error.code,
    message: error.message,
    ...(error.details ? { details: error.details } : {})
  }
});

export const validationErrorResponse = (error: ZodError): ErrorResponse => ({
  error: {
    code: "VALIDATION_ERROR",
    message: "Request validation failed",
    details: error.flatten()
  }
});
