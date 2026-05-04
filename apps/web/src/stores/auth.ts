import { create } from 'zustand';
import api from '@/lib/api';
import type { User } from '@careflow/shared';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true,

  login: async (username: string, password: string) => {
    const res = await api.post('/api/auth/login', { username, password });
    const payload = res.data?.data ?? res.data;
    const token = payload.access_token ?? payload.token;
    const refreshToken = payload.refresh_token;
    const user = payload.user;
    if (!token) throw new Error('登入回傳資料異常');
    localStorage.setItem('token', token);
    if (refreshToken) localStorage.setItem('refresh_token', refreshToken);
    set({ token, user, isLoading: false });
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    set({ user: null, token: null, isLoading: false });
    window.location.href = '/login';
  },

  hydrate: () => {
    if (typeof window === 'undefined') {
      set({ isLoading: false });
      return;
    }
    const token = localStorage.getItem('token');
    if (!token) {
      set({ isLoading: false });
      return;
    }
    set({ token });
    api
      .get('/api/auth/me')
      .then((res) => {
        const user = res.data?.data ?? res.data;
        set({ user, isLoading: false });
      })
      .catch(() => {
        localStorage.removeItem('token');
        set({ token: null, user: null, isLoading: false });
      });
  },
}));
