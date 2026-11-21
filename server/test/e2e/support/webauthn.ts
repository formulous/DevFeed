import { createHash, generateKeyPairSync, KeyObject, randomBytes, sign } from 'node:crypto';

type Cbor = number | string | Buffer | Cbor[] | Map<Cbor, Cbor> | { [key: string]: Cbor };

function head(major: number, length: number): Buffer {
  if (length < 24) return Buffer.from([(major << 5) | length]);
  if (length < 0x100) return Buffer.from([(major << 5) | 24, length]);
  if (length < 0x10000) {
    const b = Buffer.alloc(3);
    b[0] = (major << 5) | 25;
    b.writeUInt16BE(length, 1);
    return b;
  }
  const b = Buffer.alloc(5);
  b[0] = (major << 5) | 26;
  b.writeUInt32BE(length, 1);
  return b;
}

export function cbor(value: Cbor): Buffer {
  if (typeof value === 'number') return value >= 0 ? head(0, value) : head(1, -1 - value);
  if (typeof value === 'string') {
    const bytes = Buffer.from(value, 'utf8');
    return Buffer.concat([head(3, bytes.length), bytes]);
  }
  if (Buffer.isBuffer(value)) return Buffer.concat([head(2, value.length), value]);
  if (Array.isArray(value)) return Buffer.concat([head(4, value.length), ...value.map(cbor)]);
  const entries = value instanceof Map ? [...value.entries()] : Object.entries(value);
  return Buffer.concat([head(5, entries.length), ...entries.flatMap(([k, v]) => [cbor(k), cbor(v)])]);
}

const sha256 = (data: Buffer | string) => createHash('sha256').update(data).digest();
const b64 = (data: Buffer) => data.toString('base64url');

const FLAG = { UP: 0x01, UV: 0x04, BE: 0x08, BS: 0x10, AT: 0x40 };

export interface WebauthnRp {
  rpId: string;
  origin: string;
}

export interface AssertOptions {
  challenge: string;
  origin?: string;
  rpId?: string;
  counter?: number;
  userVerified?: boolean;
  userHandle?: string | null;
}

export class VirtualAuthenticator {
  readonly credentialId = randomBytes(32);
  private readonly privateKey: KeyObject;
  private readonly cose: Buffer;
  counter: number;
  userHandle: string | null = null;

  constructor(
    private readonly rp: WebauthnRp,
    options: { counter?: number } = {},
  ) {
    const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    this.privateKey = privateKey;
    const jwk = publicKey.export({ format: 'jwk' }) as { x: string; y: string };
    this.cose = cbor(
      new Map<Cbor, Cbor>([
        [1, 2],
        [3, -7],
        [-1, 1],
        [-2, Buffer.from(jwk.x, 'base64url')],
        [-3, Buffer.from(jwk.y, 'base64url')],
      ]),
    );
    this.counter = options.counter ?? 0;
  }

  get id(): string {
    return b64(this.credentialId);
  }

  private authData(rpId: string, flags: number, counter: number, attested: boolean): Buffer {
    const count = Buffer.alloc(4);
    count.writeUInt32BE(counter);
    const parts: Buffer[] = [sha256(rpId), Buffer.from([flags]), count];
    if (attested) {
      const len = Buffer.alloc(2);
      len.writeUInt16BE(this.credentialId.length);
      parts.push(Buffer.alloc(16), len, this.credentialId, this.cose);
    }
    return Buffer.concat(parts);
  }

  create(options: { challenge: string; user: { id: string } }, override: { origin?: string; userVerified?: boolean } = {}) {
    this.userHandle = options.user.id;
    const clientDataJSON = Buffer.from(
      JSON.stringify({
        type: 'webauthn.create',
        challenge: options.challenge,
        origin: override.origin ?? this.rp.origin,
        crossOrigin: false,
      }),
    );
    const flags = FLAG.UP | FLAG.AT | FLAG.BE | FLAG.BS | (override.userVerified === false ? 0 : FLAG.UV);
    const attestationObject = cbor({
      fmt: 'none',
      attStmt: {},
      authData: this.authData(this.rp.rpId, flags, this.counter, true),
    });
    return {
      id: this.id,
      rawId: this.id,
      type: 'public-key',
      response: {
        clientDataJSON: b64(clientDataJSON),
        attestationObject: b64(attestationObject),
        transports: ['internal', 'hybrid'],
      },
      clientExtensionResults: {},
      authenticatorAttachment: 'platform',
    };
  }

  assert(options: AssertOptions) {
    const counter = options.counter ?? (this.counter === 0 ? 0 : ++this.counter);
    const clientDataJSON = Buffer.from(
      JSON.stringify({
        type: 'webauthn.get',
        challenge: options.challenge,
        origin: options.origin ?? this.rp.origin,
        crossOrigin: false,
      }),
    );
    const flags = FLAG.UP | FLAG.BE | FLAG.BS | (options.userVerified === false ? 0 : FLAG.UV);
    const authenticatorData = this.authData(options.rpId ?? this.rp.rpId, flags, counter, false);
    const signature = sign('sha256', Buffer.concat([authenticatorData, sha256(clientDataJSON)]), this.privateKey);
    const userHandle = options.userHandle === undefined ? this.userHandle : options.userHandle;
    return {
      id: this.id,
      rawId: this.id,
      type: 'public-key',
      response: {
        clientDataJSON: b64(clientDataJSON),
        authenticatorData: b64(authenticatorData),
        signature: b64(signature),
        ...(userHandle ? { userHandle } : {}),
      },
      clientExtensionResults: {},
      authenticatorAttachment: 'platform',
    };
  }
}
