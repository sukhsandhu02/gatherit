const RAW_API_BASE = (import.meta.env.VITE_API_URL as string | undefined) || '';
export const API_BASE = RAW_API_BASE ? RAW_API_BASE.replace(/\/+$/, '') : '';

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
  if (API_BASE) {
    const wsBase = API_BASE.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
    return `${wsBase}${cleanPath}`;
  }
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}${cleanPath}`;
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
