import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';
import { HttpError } from '../utils/httpError.js';

export function validateBody(schema: ZodType) {
  return (request: Request, _response: Response, next: NextFunction) => {
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      next(new HttpError(400, 'Request validation failed.', parsed.error.flatten()));
      return;
    }
    request.body = parsed.data;
    next();
  };
}
