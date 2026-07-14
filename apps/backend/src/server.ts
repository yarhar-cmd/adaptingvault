import { app } from './app.js';
import { env } from './config/env.js';

const server = app.listen(env.port, () => {
  console.log(`Mirrorvault API listening at http://localhost:${env.port}`);
});

function shutdown(signal: string) {
  console.log(`${signal} received. Closing the local API.`);
  server.close(() => process.exit(0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
