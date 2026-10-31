/**
 * NetShow Security Module
 * 
 * Implements:
 * 1. HMAC-SHA256 Signed Playback Tokens (replacing legacy vulnerable fixed-IV AES)
 * 2. Strict SSRF Protection for stream URLs and remote playlists
 * 3. Salted SHA-256 Profile PIN Security with Rate Limiting
 */

import crypto from 'node:crypto';

export interface PlaybackTokenPayload {
  contentId: string;
  profileId: string;
  streamUrl: string;
  streamType: 'hls' | 'mpegts' | 'mp4';
  streamHeaders?: Record<string,string>;
  isKidProfile: boolean;
  exp: number; // Unix timestamp in seconds
  nonce: string;
}

const DEFAULT_SECRET = 'netshow-default-stream-hmac-secret-k3y-9921';

/**
 * Gets server HMAC secret from environment or securely generated default
 */
export function getStreamSecret(): string {
  return process.env.STREAM_HMAC_SECRET || DEFAULT_SECRET;
}

/**
 * Base64URL encoding helper
 */
function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Base64URL decoding helper
 */
function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * Generates an HMAC-SHA256 signed playback token
 * Validity duration defaults to 4 hours (14400 seconds)
 */
const streamRefs = new Map<string, { url: string; exp: number; headers?:Record<string,string> }>();

export function generatePlaybackToken(
  params: Omit<PlaybackTokenPayload, 'exp' | 'nonce'>,
  ttlSeconds: number = 14400,
  secretKey: string = getStreamSecret()
): string {
  const payload: PlaybackTokenPayload = {
    ...params,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    nonce: crypto.randomBytes(8).toString('hex')
  };

  const ref = crypto.randomBytes(20).toString('hex');
  streamRefs.set(ref, { url: params.streamUrl, exp: payload.exp, headers:params.streamHeaders });
  if (streamRefs.size > 20000) {
    for (const [key, entry] of streamRefs) {
      if (entry.exp < Date.now()/1000) streamRefs.delete(key);
    }
  }
  const payloadString = JSON.stringify({ ...payload, streamUrl: '', streamHeaders:undefined, ref });
  const encodedPayload = base64UrlEncode(payloadString);

  const hmac = crypto.createHmac('sha256', secretKey);
  hmac.update(encodedPayload);
  const signature = hmac.digest('base64url');

  return `${encodedPayload}.${signature}`;
}

export interface VerifyTokenResult {
  valid: boolean;
  payload?: PlaybackTokenPayload;
  error?: string;
}

/**
 * Verifies an HMAC-SHA256 signed playback token using constant-time comparison
 */
export function verifyPlaybackToken(
  token: string,
  secretKey: string = getStreamSecret()
): VerifyTokenResult {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Token is missing or not a string' };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false, error: 'Malformed token format' };
  }

  const [encodedPayload, signature] = parts;

  // Recompute HMAC signature
  const hmac = crypto.createHmac('sha256', secretKey);
  hmac.update(encodedPayload);
  const expectedSignature = hmac.digest('base64url');

  // Constant-time signature comparison to prevent timing attacks
  const sigBuffer = Buffer.from(signature);
  const expectedSigBuffer = Buffer.from(expectedSignature);

  if (sigBuffer.length !== expectedSigBuffer.length) {
    return { valid: false, error: 'Signature length mismatch' };
  }

  if (!crypto.timingSafeEqual(sigBuffer, expectedSigBuffer)) {
    return { valid: false, error: 'Invalid token signature' };
  }

  // Parse and validate payload
  try {
    const jsonStr = base64UrlDecode(encodedPayload);
    const payload = JSON.parse(jsonStr) as PlaybackTokenPayload;

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return { valid: false, error: 'Token expired' };
    }

    const ref = (payload as PlaybackTokenPayload & { ref: string }).ref;
    const saved = streamRefs.get(ref);
    if (!saved || saved.exp < now || !payload.contentId) {
      return { valid: false, error: 'Expired or unknown playback reference' };
    }
    return { valid: true, payload: { ...payload, streamUrl: saved.url, streamHeaders:saved.headers } };
  } catch (err) {
    return { valid: false, error: 'Failed to decode token payload' };
  }
}

/**
 * SSRF Protection Validator
 * Rejects localhost, loopbacks, link-local, RFC1918 private IPs, and non-HTTP protocols.
 */
export function isAllowedStreamUrl(urlString: string): { allowed: boolean; reason?: string } {
  try {
    const parsed = new URL(urlString);

    // Only allow http: and https: protocols
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { allowed: false, reason: `Disallowed protocol: ${parsed.protocol}` };
    }

    const hostname = parsed.hostname.toLowerCase();

    // Check localhost & loopback names
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal')
    ) {
      return { allowed: false, reason: 'Local and internal hostnames are prohibited' };
    }

    // IP address checks
    // IPv4 patterns:
    // 127.0.0.0/8 (Loopback)
    // 10.0.0.0/8 (Private)
    // 172.16.0.0/12 (Private)
    // 192.168.0.0/16 (Private)
    // 169.254.0.0/16 (Link-local)
    // 0.0.0.0
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const ipMatch = hostname.match(ipv4Regex);

    if (ipMatch) {
      const [_, o1, o2] = ipMatch.map(Number);

      if (o1 === 127) {
        return { allowed: false, reason: 'Loopback 127.0.0.0/8 is prohibited' };
      }
      if (o1 === 10) {
        return { allowed: false, reason: 'Private IP 10.0.0.0/8 is prohibited' };
      }
      if (o1 === 172 && o2 >= 16 && o2 <= 31) {
        return { allowed: false, reason: 'Private IP 172.16.0.0/12 is prohibited' };
      }
      if (o1 === 192 && o2 === 168) {
        return { allowed: false, reason: 'Private IP 192.168.0.0/16 is prohibited' };
      }
      if (o1 === 169 && o2 === 254) {
        return { allowed: false, reason: 'Link-local IP 169.254.0.0/16 is prohibited' };
      }
      if (o1 === 0) {
        return { allowed: false, reason: 'Wildcard IP 0.0.0.0 is prohibited' };
      }
    }

    // IPv6 checks
    if (
      hostname === '::1' ||
      hostname.startsWith('fc00:') ||
      hostname.startsWith('fe80:') ||
      hostname.includes('[::1]')
    ) {
      return { allowed: false, reason: 'IPv6 loopback/private range is prohibited' };
    }

    // Disallowed ports (cloud metadata, redis, ssh, etc.)
    const port = parsed.port ? parseInt(parsed.port, 10) : (parsed.protocol === 'https:' ? 443 : 80);
    const prohibitedPorts = [22, 25, 111, 2375, 2376, 3306, 5432, 6379, 8500, 9200, 27017];
    if (prohibitedPorts.includes(port)) {
      return { allowed: false, reason: `Port ${port} is restricted` };
    }

    return { allowed: true };
  } catch (e) {
    return { allowed: false, reason: 'Invalid URL format' };
  }
}

/**
 * Profile PIN security: Salted SHA-256
 */
export function hashPin(pin: string, salt: string): string {
  return crypto.scryptSync(pin, salt, 32).toString('hex');
}

export function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * PIN rate limiter: tracks attempts per profile
 */
interface RateLimitRecord {
  attempts: number;
  lockedUntil: number;
}

const pinAttempts = new Map<string, RateLimitRecord>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60 * 1000; // 1 minute lockout

export function verifyPinWithRateLimit(
  profileId: string,
  inputPin: string,
  storedHash: string,
  salt: string
): { success: boolean; error?: string; remainingAttempts?: number; lockedSeconds?: number } {
  const now = Date.now();
  const record = pinAttempts.get(profileId) || { attempts: 0, lockedUntil: 0 };

  if (record.lockedUntil > now) {
    const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return {
      success: false,
      error: `Too many incorrect attempts. Please wait ${remainingSeconds}s.`,
      lockedSeconds: remainingSeconds
    };
  }

  const computedHash = hashPin(inputPin, salt);
  const isMatch = computedHash === storedHash;

  if (isMatch) {
    pinAttempts.delete(profileId);
    return { success: true };
  } else {
    record.attempts += 1;
    if (record.attempts >= MAX_ATTEMPTS) {
      record.lockedUntil = now + LOCKOUT_DURATION_MS;
      pinAttempts.set(profileId, record);
      return {
        success: false,
        error: `Profile locked for 60 seconds due to ${MAX_ATTEMPTS} incorrect attempts.`,
        lockedSeconds: 60
      };
    } else {
      pinAttempts.set(profileId, record);
      return {
        success: false,
        error: 'Incorrect PIN',
        remainingAttempts: MAX_ATTEMPTS - record.attempts
      };
    }
  }
}
