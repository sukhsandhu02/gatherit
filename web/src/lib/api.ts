const RAW_API_BASE = (import.meta.env.VITE_API_URL as string | undefined) || '';
export const API_BASE = RAW_API_BASE ? RAW_API_BASE.replace(/\/+$/, '') : '';

const GUEST_TOKEN_KEY = 'gatherit_guest_token';
const HOST_TOKEN_KEY = 'gatherit_host_token';

export function getGuestToken(): string | null {
  try {
    return localStorage.getItem(GUEST_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setGuestToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(GUEST_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(GUEST_TOKEN_KEY);
    }
  } catch {}
}

export function getHostToken(): string | null {
  try {
    return localStorage.getItem(HOST_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setHostToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(HOST_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(HOST_TOKEN_KEY);
    }
  } catch {}
}

export function getApiUrl(endpoint: string): string {
  if (!endpoint) return '';
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  const clean = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return API_BASE ? `${API_BASE}${clean}` : clean;
}

export function getWsUrl(path: string = '/ws'): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  let base: string;
  if (API_BASE) {
    base = API_BASE.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
  } else {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    base = `${proto}//${window.location.host}`;
  }

  const token = getGuestToken() || getHostToken();
  if (token) {
    const separator = cleanPath.includes('?') ? '&' : '?';
    return `${base}${cleanPath}${separator}token=${encodeURIComponent(token)}`;
  }
  return `${base}${cleanPath}`;
}

export function getMediaUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('blob:') || path.startsWith('data:')) {
    return path;
  }
  const clean = path.startsWith('/') ? path : `/${path}`;
  return API_BASE ? `${API_BASE}${clean}` : clean;
}

export async function api<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});

  if (!headers.has('Authorization')) {
    const isHostRoute = endpoint.includes('/host');
    const token = isHostRoute
      ? (getHostToken() || getGuestToken())
      : (getGuestToken() || getHostToken());
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  if (
    options.body &&
    !headers.has('Content-Type') &&
    !(options.body instanceof FormData)
  ) {
    headers.set('Content-Type', 'application/json');
  }

  const url = getApiUrl(endpoint);

  const res = await fetch(url, {
    credentials: options.credentials || 'include',
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error: any = new Error(data.error || 'Network request failed');
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data as T;
}
