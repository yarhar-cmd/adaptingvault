import cors from 'cors';
import express from 'express';
import morgan from 'morgan';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { apiRouter } from './routes/index.js';

export const app = express();

app.disable('x-powered-by');
app.use(cors({ origin: env.frontendOrigin }));
app.use(express.json({ limit: '64kb' }));
app.use(morgan(env.nodeEnv === 'development' ? 'dev' : 'combined'));
app.use('/api', apiRouter);
app.use(notFoundHandler);
app.use(errorHandler);
