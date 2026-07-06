const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('sentrygrid_access_token');
}

function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('sentrygrid_refresh_token');
}

export function setTokens(accessToken: string, refreshToken?: string) {
  window.localStorage.setItem('sentrygrid_access_token', accessToken);
  if (refreshToken) window.localStorage.setItem('sentrygrid_refresh_token', refreshToken);
}

export function clearTokens() {
  window.localStorage.removeItem('sentrygrid_access_token');
  window.localStorage.removeItem('sentrygrid_refresh_token');
  window.localStorage.removeItem('sentrygrid_user');
}

async function tryRefresh(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  const res = await fetch(`${API_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) return null;

  const data = await res.json();
  setTokens(data.accessToken);
  return data.accessToken as string;
}

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
}

/**
 * Central fetch wrapper. Attaches the bearer token, and on a single 401
 * transparently tries a refresh-and-retry before giving up and surfacing
 * the error (callers/AuthProvider handle redirecting to /login on failure).
 */
export async function apiFetch<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { skipAuth, headers, ...rest } = options;

  const doFetch = async (token: string | null) => {
    return fetch(`${API_URL}${path}`, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...(token && !skipAuth ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    });
  };

  let res = await doFetch(getAccessToken());

  if (res.status === 401 && !skipAuth) {
    const newToken = await tryRefresh();
    if (newToken) {
      res = await doFetch(newToken);
    }
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      message = body.error ?? message;
    } catch {
      // response had no JSON body
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
