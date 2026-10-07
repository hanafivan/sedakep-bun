export type ApiResponse<T> = {
  success: boolean;
  data: T;
  message: string;
  code: number;
  details?: unknown;
};

export type User = {
  id: string;
  username: string;
  createdAt: string;
};

export type LoginResult = {
  token: string;
  user: User;
};

const TOKEN_KEY = 'token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token: string) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

/** Panggilan API dasar. Melempar Error berisi pesan dari backend. */
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');

  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(path, { ...options, headers });
  const body = (await response.json()) as ApiResponse<T>;

  if (!response.ok) {
    throw new Error(body.message || `Request gagal (${response.status})`);
  }

  return body;
}

export const register = (username: string, password: string) =>
  api<null>('/api/v1/users/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });

export const login = (username: string, password: string) =>
  api<LoginResult>('/api/v1/users/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });

export const me = () => api<User>('/api/v1/users/me');
