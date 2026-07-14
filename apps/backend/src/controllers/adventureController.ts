import type { RequestHandler } from 'express';
import { createAdventure, listAdventures } from '../services/adventureService.js';
import type { AdventureConfig } from '../types/adventure.js';

export const getAdventures: RequestHandler = (_request, response) => {
  response.json(listAdventures());
};

export const postAdventure: RequestHandler = (request, response) => {
  response.status(201).json(createAdventure(request.body as AdventureConfig));
};
