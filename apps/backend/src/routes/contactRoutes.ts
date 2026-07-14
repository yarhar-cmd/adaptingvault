import { Router } from 'express';
import { z } from 'zod';
import { postContact } from '../controllers/contactController.js';
import { validateBody } from '../middleware/validate.js';

const contactSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email().max(200),
  message: z.string().trim().min(10).max(4000),
});

export const contactRouter = Router();
contactRouter.post('/', validateBody(contactSchema), postContact);
