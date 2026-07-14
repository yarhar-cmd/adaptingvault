import type { RequestHandler } from 'express';

export const getHealth: RequestHandler = (_request, response) => {
  response.json({ status: 'ok', service: 'mirrorvault-api' });
};
