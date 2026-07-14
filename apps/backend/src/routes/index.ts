import { Router } from 'express';
import { adventureRouter } from './adventureRoutes.js';
import { contactRouter } from './contactRoutes.js';
import { healthRouter } from './healthRoutes.js';

export const apiRouter = Router();
apiRouter.use('/health', healthRouter);
apiRouter.use('/adventures', adventureRouter);
apiRouter.use('/contact', contactRouter);
