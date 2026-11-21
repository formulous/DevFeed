import {
  browserSupportsWebAuthn,
  browserSupportsWebAuthnAutofill,
  startAuthentication,
  startRegistration,
  WebAuthnAbortService,
} from '@simplewebauthn/browser';
import { passkeyLoginOptions, passkeyRegistrationOptions, registerPasskey } from '@/api/passkeys';

export const PASSKEY_ENABLED = import.meta.env.VITE_PASSKEY !== 'false';

export function passkeyAvailable() {
  return PASSKEY_ENABLED && browserSupportsWebAuthn();
}

export function isPasskeyCancel(error: unknown) {
  if (!(error instanceof Error)) return false;
  const code = (error as { code?: string }).code;
  return error.name === 'NotAllowedError' || error.name === 'AbortError' || code === 'ERROR_CEREMONY_ABORTED';
}

export async function getPasskeyAssertion(autofill = false) {
  if (autofill && !(await browserSupportsWebAuthnAutofill())) return null;
  const optionsJSON = await passkeyLoginOptions();
  return startAuthentication({ optionsJSON, useBrowserAutofill: autofill });
}

export function cancelPasskeyCeremony() {
  WebAuthnAbortService.cancelCeremony();
}

export function deviceName(ua = navigator.userAgent) {
  const device = /iPhone/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua)
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android'
        : /Mac OS X|Macintosh/.test(ua)
          ? 'Mac'
          : /Windows/.test(ua)
            ? 'Windows'
            : /Linux/.test(ua)
              ? 'Linux'
              : '기기';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /SamsungBrowser/.test(ua)
      ? 'Samsung Internet'
      : /Firefox|FxiOS/.test(ua)
        ? 'Firefox'
        : /Chrome|CriOS/.test(ua)
          ? 'Chrome'
          : /Safari/.test(ua)
            ? 'Safari'
            : '';
  return browser ? `${device} ${browser}` : device;
}

export async function createPasskey() {
  const optionsJSON = await passkeyRegistrationOptions();
  const credential = await startRegistration({ optionsJSON });
  return registerPasskey(credential, deviceName());
}

let offerAfterSignup = false;

export const passkeyOffer = {
  set: (value: boolean) => {
    offerAfterSignup = value;
  },
  pending: () => offerAfterSignup && passkeyAvailable(),
};
