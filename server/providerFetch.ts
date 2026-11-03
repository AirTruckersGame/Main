import { EnvHttpProxyAgent } from 'undici';
import type { Fetcher } from './providers.js';
// Respect managed-environment proxies and normal TLS trust. Vercel normally has
// no proxy variables, in which case the standard server fetch is used unchanged.
let dispatcher: EnvHttpProxyAgent | undefined;
export const providerFetch: Fetcher = (input, init) => {
  const proxied = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.https_proxy || process.env.http_proxy;
  if (!proxied) return fetch(input, init);
  dispatcher ??= new EnvHttpProxyAgent();
  return fetch(input, { ...init, dispatcher } as RequestInit & { dispatcher: EnvHttpProxyAgent });
};
