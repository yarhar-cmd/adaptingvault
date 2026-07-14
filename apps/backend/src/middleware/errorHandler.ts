import type { ErrorRequestHandler, RequestHandler } from 'express';
import { HttpError } from '../utils/httpError.js';

export const notFoundHandler: RequestHandler = (request, _response, next) => {
  next(new HttpError(404, `No API route matches ${request.method} ${request.path}.`));
};

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  void _next;
  if (error instanceof HttpError) {
    response.status(error.status).json({ error: error.message, details: error.details });
    return;
  }
  console.error(error);
  response.status(500).json({ error: 'The local API encountered an unexpected error.' });
};
