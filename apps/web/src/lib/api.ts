import axios, { AxiosError, AxiosRequestConfig } from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Refresh token 並發控制：只重試一次，避免無限迴圈
let refreshPromise: Promise<string | null> | null = null;

async function tryRefresh(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  const rt = typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null;
  if (!rt) return null;

  refreshPromise = axios
    .post(`${BASE_URL}/api/auth/refresh`, { refresh_token: rt })
    .then((res) => {
      const newToken = res.data?.access_token ?? res.data?.data?.access_token;
      if (newToken) localStorage.setItem('token', newToken);
      return newToken ?? null;
    })
    .catch(() => null)
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };
    if (
      error.response?.status === 401
      && typeof window !== 'undefined'
      && !originalRequest._retry
      && !originalRequest.url?.includes('/auth/refresh')
      && !originalRequest.url?.includes('/auth/login')
    ) {
      originalRequest._retry = true;
      const newToken = await tryRefresh();
      if (newToken) {
        originalRequest.headers = originalRequest.headers ?? {};
        (originalRequest.headers as Record<string, string>).Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      }
      // refresh 失敗 → 登出
      localStorage.removeItem('token');
      localStorage.removeItem('refresh_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export default api;
