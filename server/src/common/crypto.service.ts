import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createHash,
  createHmac,
  randomBytes,
  createDecipheriv,
} from 'node:crypto';

/**
 * AES-256-GCM at-rest encryption for Swiggy access tokens, plus PKCE helpers.
 * Tokens are sensitive (5-day validity, no refresh) so they never touch the
 * browser and are encrypted in the DB.
 */
@Injectable()
export class CryptoService implements OnModuleInit {
  private key!: Buffer;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const hex = this.config.get<string>('secrets.tokenEncKey') ?? '';
    if (hex.length !== 64) {
      throw new Error(
        'TOKEN_ENC_KEY must be 32 bytes as 64 hex chars. Generate with: openssl rand -hex 32',
      );
    }
    this.key = Buffer.from(hex, 'hex');
  }

  /** Returns iv.tag.ciphertext, all base64url, dot-joined. */
  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [b64u(iv), b64u(tag), b64u(ct)].join('.');
  }

  decrypt(payload: string): string {
    const [iv, tag, ct] = payload.split('.').map((p) => Buffer.from(p, 'base64url'));
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
  }

  // ── PKCE (RFC 7636) ──
  /** 32-byte high-entropy verifier, base64url. */
  pkceVerifier(): string {
    return b64u(randomBytes(32));
  }
  /** S256 challenge = base64url(SHA256(verifier)). */
  pkceChallenge(verifier: string): string {
    return b64u(createHash('sha256').update(verifier).digest());
  }
  randomState(): string {
    return b64u(randomBytes(16));
  }

  /** HMAC-signed opaque token used for group invites. */
  signInvite(payload: string): string {
    const secret = this.config.get<string>('secrets.appJwtSecret') ?? 'dev';
    const sig = b64u(createHmac('sha256', secret).update(payload).digest()).slice(0, 16);
    return `${b64u(Buffer.from(payload))}.${sig}`;
  }
}

function b64u(buf: Buffer): string {
  return buf.toString('base64url');
}
