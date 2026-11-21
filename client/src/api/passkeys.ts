import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/browser';
import { request } from './http';
import type { AuthResponse, Passkey } from './types';

export function passkeyLoginOptions(signal?: AbortSignal) {
  return request<PublicKeyCredentialRequestOptionsJSON>('/auth/passkeys/login/options', { method: 'POST', signal });
}

export function passkeyLogin(credential: AuthenticationResponseJSON) {
  return request<AuthResponse>('/auth/passkeys/login', { method: 'POST', json: { credential } });
}

export function passkeyRegistrationOptions() {
  return request<PublicKeyCredentialCreationOptionsJSON>('/me/passkeys/registration/options', { method: 'POST' });
}

export function registerPasskey(credential: RegistrationResponseJSON, name?: string) {
  return request<Passkey>('/me/passkeys', { method: 'POST', json: { credential, name } });
}

export function fetchPasskeys(signal?: AbortSignal) {
  return request<{ items: Passkey[] }>('/me/passkeys', { signal });
}

export function renamePasskey(id: number, name: string) {
  return request<Passkey>(`/me/passkeys/${id}`, { method: 'PATCH', json: { name } });
}

export function deletePasskey(id: number) {
  return request<void>(`/me/passkeys/${id}`, { method: 'DELETE' });
}
