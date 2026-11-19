import { request } from './http';
import type { AuthResponse, Me } from './types';

export function login(email: string, password: string) {
  return request<AuthResponse>('/auth/login', { method: 'POST', json: { email, password } });
}

export function logout() {
  return request<void>('/auth/logout', { method: 'POST' });
}

export function fetchMe() {
  return request<Me>('/me');
}
