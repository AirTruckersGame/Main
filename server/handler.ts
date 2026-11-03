import type { IncomingMessage, ServerResponse } from 'node:http';
import { providerFetch } from './providerFetch.js';
import { createEfbService } from './service.js';
const handle = createEfbService(providerFetch);
export default async function handler(request: IncomingMessage, response: ServerResponse) {
  try {
    const forwarded = request.headers['x-forwarded-for'];
    const client = (typeof forwarded === 'string' ? forwarded.split(',')[0] : request.socket.remoteAddress ?? 'unknown').slice(0, 64);
    const result = await handle(request.method ?? 'GET', new URL(request.url ?? '/', 'http://localhost'), client);
    response.statusCode = result.status; for (const [key, value] of Object.entries(result.headers)) response.setHeader(key, value);
    response.end(result.body instanceof Uint8Array ? result.body : JSON.stringify(result.body));
  } catch { response.statusCode = 503; response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({ error: 'Data Unavailable' })); }
}
