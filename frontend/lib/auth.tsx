'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, setTokens, clearTokens, ApiError } from './api';
import { User } from './types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { email: string; password: string; name: string; organizationName: string }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const cached = window.localStorage.getItem('sentrygrid_user');
    if (cached) {
      try {
        setUser(JSON.parse(cached));
      } catch {
        // ignore corrupt cache
      }
    }

    apiFetch<{ user: User }>('/api/auth/me')
      .then(({ user }) => {
        setUser(user);
        window.localStorage.setItem('sentrygrid_user', JSON.stringify(user));
      })
      .catch(() => {
        setUser(null);
        clearTokens();
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const data = await apiFetch<{ accessToken: string; refreshToken: string; user: User }>(
      '/api/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }), skipAuth: true },
    );
    setTokens(data.accessToken, data.refreshToken);
    window.localStorage.setItem('sentrygrid_user', JSON.stringify(data.user));
    setUser(data.user);
    router.push('/dashboard');
  }

  async function register(input: { email: string; password: string; name: string; organizationName: string }) {
    const data = await apiFetch<{ accessToken: string; refreshToken: string; user: User }>(
      '/api/auth/register',
      { method: 'POST', body: JSON.stringify(input), skipAuth: true },
    );
    setTokens(data.accessToken, data.refreshToken);
    window.localStorage.setItem('sentrygrid_user', JSON.stringify(data.user));
    setUser(data.user);
    router.push('/dashboard');
  }

  function logout() {
    clearTokens();
    setUser(null);
    router.push('/login');
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}
