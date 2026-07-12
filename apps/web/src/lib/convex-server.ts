import { ConvexHttpClient } from 'convex/browser';
import { api } from '@fincasya/backend/convex/_generated/api';

let client: ConvexHttpClient | null = null;

export function getConvexHttpClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) throw new Error('NEXT_PUBLIC_CONVEX_URL no configurada');
  if (!client) client = new ConvexHttpClient(url);
  return client;
}

export { api };
