import 'dotenv/config';

function port(value: string | undefined): number {
  const parsed = Number(value ?? 3001);
  return Number.isFinite(parsed) ? parsed : 3001;
}

export const env = {
  port: port(process.env.PORT),
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
  nodeEnv: process.env.NODE_ENV ?? 'development',
};
