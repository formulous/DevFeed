import { http, HttpResponse } from 'msw';
import type { Me, Passkey } from '@/api/types';

interface Ctx {
  isMember: (request: Request) => boolean;
  me: () => Me | null;
  startSession: (me: Me, password: string) => Response;
  error: (status: number, code: string, message: string) => Response;
}

interface StoredPasskey extends Passkey {
  credentialId: string;
  owner: Me;
  password: string;
}

export const PASSKEY_MAX = 10;

const store = { items: [] as StoredPasskey[], seq: 0, password: '' };

export const mockPasskeys = store;

export function resetPasskeys() {
  store.items = [];
  store.seq = 0;
}

export function setPasskeyPassword(password: string) {
  store.password = password;
}

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const random = (n: number) => b64url(crypto.getRandomValues(new Uint8Array(n)));
const rpId = (request: Request) => new URL(request.url).hostname;
const view = ({ id, name, createdAt, lastUsedAt }: StoredPasskey): Passkey => ({ id, name, createdAt, lastUsedAt });

export function seedPasskey(owner: Me, credentialId: string, name = 'Mac Chrome') {
  store.items.unshift({
    id: ++store.seq,
    name,
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
    credentialId,
    owner,
    password: store.password,
  });
}

export function passkeyHandlers({ isMember, me, startSession, error }: Ctx) {
  const mine = () => store.items.filter((p) => p.owner.id === me()?.id && p.owner.email === me()?.email);
  const unauth = () => error(401, 'UNAUTHENTICATED', '로그인이 필요해요');

  return [
    http.post('*/api/auth/passkeys/login/options', ({ request }) =>
      HttpResponse.json({
        challenge: random(32),
        rpId: rpId(request),
        timeout: 300000,
        userVerification: 'required',
        allowCredentials: [],
      }),
    ),

    http.post('*/api/auth/passkeys/login', async ({ request }) => {
      const { credential } = (await request.json()) as { credential?: { id?: string } };
      if (!credential?.id) return error(400, 'VALIDATION_FAILED', '요청 값이 올바르지 않아요');
      const found = store.items.find((p) => p.credentialId === credential.id);
      if (!found) return error(401, 'PASSKEY_NOT_FOUND', '이 패스키로 가입된 계정을 찾을 수 없어요');
      found.lastUsedAt = new Date().toISOString();
      return startSession(found.owner, found.password);
    }),

    http.post('*/api/me/passkeys/registration/options', ({ request }) => {
      const user = isMember(request) ? me() : null;
      if (!user) return unauth();
      if (mine().length >= PASSKEY_MAX) return error(409, 'PASSKEY_LIMIT_EXCEEDED', '패스키는 10개까지 만들 수 있어요');
      return HttpResponse.json({
        challenge: random(32),
        rp: { name: 'DevFeed', id: rpId(request) },
        user: { id: b64url(new TextEncoder().encode(`devfeed-${user.id}-${user.email}`)), name: user.email, displayName: user.nickname },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        timeout: 300000,
        attestation: 'none',
        excludeCredentials: mine().map((p) => ({ id: p.credentialId, type: 'public-key' })),
        authenticatorSelection: { residentKey: 'required', requireResidentKey: true, userVerification: 'required' },
      });
    }),

    http.get('*/api/me/passkeys', ({ request }) => (isMember(request) ? HttpResponse.json({ items: mine().map(view) }) : unauth())),

    http.post('*/api/me/passkeys', async ({ request }) => {
      const user = isMember(request) ? me() : null;
      if (!user) return unauth();
      const { credential, name } = (await request.json()) as { credential?: { id?: string }; name?: string };
      if (!credential?.id) return error(400, 'PASSKEY_VERIFICATION_FAILED', '패스키를 확인하지 못했어요. 다시 시도해 주세요');
      if (mine().length >= PASSKEY_MAX) return error(409, 'PASSKEY_LIMIT_EXCEEDED', '패스키는 10개까지 만들 수 있어요');
      if (store.items.some((p) => p.credentialId === credential.id)) return error(409, 'PASSKEY_ALREADY_REGISTERED', '이미 등록된 패스키예요');
      const created: StoredPasskey = {
        id: ++store.seq,
        name: name?.trim().slice(0, 40) || `패스키 ${mine().length + 1}`,
        createdAt: new Date().toISOString(),
        lastUsedAt: null,
        credentialId: credential.id,
        owner: user,
        password: store.password,
      };
      store.items.unshift(created);
      return HttpResponse.json(view(created), { status: 201 });
    }),

    http.patch('*/api/me/passkeys/:id', async ({ request, params }) => {
      if (!isMember(request)) return unauth();
      const found = mine().find((p) => p.id === Number(params.id));
      if (!found) return error(404, 'NOT_FOUND', '대상을 찾을 수 없어요');
      const name = String(((await request.json()) as { name?: string }).name ?? '').trim();
      if (name.length < 1 || name.length > 40) {
        return HttpResponse.json(
          { code: 'VALIDATION_FAILED', message: '요청 값이 올바르지 않아요', fieldErrors: [{ field: 'name', message: '1~40자로 입력해 주세요' }] },
          { status: 400 },
        );
      }
      found.name = name;
      return HttpResponse.json(view(found));
    }),

    http.delete('*/api/me/passkeys/:id', ({ request, params }) => {
      if (!isMember(request)) return unauth();
      const found = mine().find((p) => p.id === Number(params.id));
      if (!found) return error(404, 'NOT_FOUND', '대상을 찾을 수 없어요');
      store.items = store.items.filter((p) => p !== found);
      return new HttpResponse(null, { status: 204 });
    }),
  ];
}
