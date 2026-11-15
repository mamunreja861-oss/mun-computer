import type { IncomingMessage, ServerResponse } from 'http';
import app, { initServerServices } from '../server.js';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await initServerServices();
  return app(req as any, res as any);
}
