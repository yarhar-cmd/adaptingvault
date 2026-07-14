import type { RequestHandler } from 'express';
import { acceptContactMessage, type ContactMessage } from '../services/contactService.js';

export const postContact: RequestHandler = (request, response) => {
  response.status(202).json(acceptContactMessage(request.body as ContactMessage));
};
