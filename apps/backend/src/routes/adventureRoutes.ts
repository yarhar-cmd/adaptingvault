import { Router } from 'express';
import { z } from 'zod';
import { getAdventures, postAdventure } from '../controllers/adventureController.js';
import { validateBody } from '../middleware/validate.js';

const adventureSchema = z.object({
  experience: z.enum(['new', 'occasional', 'veteran']),
  challenge: z.enum(['relaxed', 'balanced', 'demanding']),
  playstyle: z.enum(['balanced', 'combat', 'puzzle', 'exploration']),
  mode: z.enum(['adaptive', 'random']),
  characterId: z.string().trim().min(1).max(80),
});

export const adventureRouter = Router();
adventureRouter.get('/', getAdventures);
adventureRouter.post('/', validateBody(adventureSchema), postAdventure);
