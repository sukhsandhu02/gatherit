import { storage } from './storage';

export const FALLBACK_URLS = [
  'http://127.0.0.1:8080',
  'http://10.158.255.18:8080',
  'https://omarchy.tailedcbcc.ts.net',
  'https://omarchy.tailedcbcc.ts.net:8443',
];

async function probeUrl(url: string, timeoutMs: number = 1500): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const clean = url.replace(/\/+$/, '');
    const res = await fetch(`${clean}/api/health`, {
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function findWorkingBaseUrl(currentBase: string): Promise<string | null> {
  const candidates = [
    'http://127.0.0.1:8080',
    'http://10.158.255.18:8080',
    ...FALLBACK_URLS,
  ].filter((u, i, arr) => arr.indexOf(u) === i && u !== currentBase);

  const probe = async (url: string): Promise<string> => {
    const ok = await probeUrl(url, 1500);
    if (ok) return url;
    throw new Error('Unreachable');
  };

  try {
    return await Promise.any(candidates.map(probe));
  } catch {
    return null;
  }
}

export async function apiClient<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  let baseUrl = await storage.getServerUrl();
  const token = await storage.getToken();

  if (baseUrl.includes('omarchy.tailedcbcc.ts.net')) {
    baseUrl = baseUrl.includes(':8443')
      ? 'https://omarchy.tailedcbcc.ts.net:8443'
      : 'https://omarchy.tailedcbcc.ts.net';
  }

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  const buildUrl = (base: string) => {
    const cleanBase = base.replace(/\/+$/, '');
    return endpoint.startsWith('http') ? endpoint : `${cleanBase}${cleanEndpoint}`;
  };

  const headers = new Headers(options.headers || {});
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('Cookie', `guest_token=${token}`);
  }

  if (
    options.body &&
    !headers.has('Content-Type') &&
    !(options.body instanceof FormData)
  ) {
    headers.set('Content-Type', 'application/json');
  }

  const executeFetch = async (targetBase: string): Promise<T> => {
    const url = buildUrl(targetBase);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    try {
      const res = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const error: any = new Error(data.error || `HTTP ${res.status}`);
        error.status = res.status;
        error.data = data;
        throw error;
      }

      return data as T;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  try {
    return await executeFetch(baseUrl);
  } catch (err: any) {
    // If it's a specific HTTP 4xx error (e.g. 401 Unauthorized, 404, 409), throw directly
    if (err.status && err.status >= 400 && err.status < 500) {
      throw err;
    }

    // Network timeout or unreachable error -> probe candidate URLs
    console.warn(`[apiClient] Connection to ${baseUrl} failed, probing alternatives...`);
    const recoveredUrl = await findWorkingBaseUrl(baseUrl);
    if (recoveredUrl && recoveredUrl !== baseUrl) {
      console.log(`[apiClient] Auto-recovered to working server at ${recoveredUrl}`);
      await storage.setServerUrl(recoveredUrl);
      return await executeFetch(recoveredUrl);
    }

    const offlineErr: any = new Error(`Cannot connect to host server at ${baseUrl}. Make sure the event host is running.`);
    offlineErr.isOffline = true;
    offlineErr.originalError = err;
    throw offlineErr;
  }
}
