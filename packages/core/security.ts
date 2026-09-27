import { createHash, randomBytes, timingSafeEqual, createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { AppError, invariant } from './errors.ts';

export function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.entries(value).sort(([a], [b]) => a.localeCompare(b, 'en'))
    .map(([k, v]) => JSON.stringify(k) + ':' + canonical(v)).join(',') + '}';
  const s = JSON.stringify(value);
  invariant(s !== undefined, 'INVALID_JSON', 'Valeur JSON invalide.');
  return s;
}
export const sha256 = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
export const digest = (value: unknown) => sha256(canonical(value));
export const nonce = () => randomBytes(24).toString('hex');

const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bsk-(?:proj-|svcacct-|svcac-|or-v1-)?[A-Za-z0-9_-]{24,}\b/,
  /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{18,}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{25,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{30,}\b/,
  /\bAKIA[A-Z0-9]{16}\b/,
  /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/,
  /(?:password|api[_-]?key|secret|access[_-]?token)\s*[:=]\s*["']?(?!\s*(?:["']?\s*$|process\.|os\.|<|\$\{|YOUR_|REPLACE_|PLACEHOLDER|example|changeme))[A-Za-z0-9_\/+.-]{32,}/i
];
export function containsSecret(value: string, known: string[] = []): boolean {
  return secretPatterns.some(p => p.test(value)) || known.some(s => s.length >= 12 && value.includes(s));
}
export function rejectSecrets(value: string, known: string[] = []): void {
  invariant(!containsSecret(value, known), 'SECRET_DETECTED', 'Une donnée ressemblant à un secret a été détectée. Ne partage pas de clé API.');
}
export function redact(value: string, known: string[] = []): string {
  let result = value;
  for (const pattern of secretPatterns) result = result.replace(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g'), '[REDACTED]');
  for (const s of known.filter(s => s.length >= 12)) result = result.split(s).join('[REDACTED]');
  return result.slice(0, 100000);
}
export function safePath(input: string): string {
  invariant(input === input.normalize('NFC') && input.length <= 180 && /^[A-Za-z0-9_./@-]+$/.test(input), 'UNSAFE_PATH', 'Nom de fichier non autorisé.');
  const parts = input.split('/');
  invariant(!input.startsWith('/') && parts.every(p => p && p !== '.' && p !== '..' && !p.endsWith('.') &&
    !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p)), 'UNSAFE_PATH', 'Chemin de fichier non autorisé.');
  invariant(!parts.some(p => ['.git', 'node_modules', '.data', '.ssh', '.aws', '.npmrc', '.pypirc'].includes(p.toLowerCase())), 'UNSAFE_PATH', 'Chemin privé interdit.');
  invariant(parts.every(p => !p.toLowerCase().startsWith('.env') || p === '.env.example'), 'SECRET_FILE', 'Seul .env.example est autorisé.');
  return input;
}
export function fixedHttpsUrl(value: string, allowedHosts?: string[]): URL {
  const u = new URL(value);
  invariant(u.protocol === 'https:' && !u.username && !u.password && !u.hash && (!u.port || u.port === '443'), 'UNSAFE_URL', 'URL HTTPS publique requise.');
  invariant(!isIP(u.hostname) && u.hostname.includes('.') && !/(?:localhost|\.local|\.internal|\.test)$/.test(u.hostname), 'UNSAFE_URL', 'Hôte non autorisé.');
  if (allowedHosts) invariant(allowedHosts.includes(u.hostname), 'UNSAFE_URL', 'Hôte non autorisé.');
  return u;
}
export async function limitedFetch(url: string | URL, init: RequestInit = {}, maxBytes = 2_000_000, timeout = 45000): Promise<{response: Response; body: string}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...init, redirect: 'error', signal: controller.signal });
    const length = Number(response.headers.get('content-length') ?? 0);
    invariant(length <= maxBytes, 'RESPONSE_LIMIT', 'Réponse distante trop grande.', 502);
    const reader = response.body?.getReader(); const chunks: Uint8Array[] = []; let size = 0;
    if (reader) {
      try {
        for (;;) { const r = await reader.read(); if (r.done) break; size += r.value.length;
          invariant(size <= maxBytes, 'RESPONSE_LIMIT', 'Réponse distante trop grande.', 502); chunks.push(r.value); }
      } catch (e) { await reader.cancel(); throw e; }
    }
    return { response, body: Buffer.concat(chunks).toString('utf8') };
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError('EXTERNAL_UNAVAILABLE', 'Service externe indisponible ou délai dépassé.', 503);
  } finally { clearTimeout(timer); }
}
export function verifyStripeSignature(raw: Uint8Array, header: string, secret: string, now = Date.now()): void {
  invariant(secret.length >= 16 && raw.length <= 1_000_000, 'INVALID_SIGNATURE', 'Signature invalide.', 400);
  const fields = header.split(',').map(s => s.trim().split('=', 2));
  const ts = fields.filter(([k]) => k === 't');
  invariant(ts.length === 1 && /^\d+$/.test(ts[0][1] ?? ''), 'INVALID_SIGNATURE', 'Signature invalide.');
  const timestamp = Number(ts[0][1]);
  invariant(Math.abs(now / 1000 - timestamp) <= 300, 'STALE_SIGNATURE', 'Signature expirée.');
  const expected = createHmac('sha256', secret).update(ts[0][1] + '.').update(raw).digest();
  invariant(fields.some(([k, v]) => k === 'v1' && /^[a-f0-9]{64}$/.test(v ?? '') && timingSafeEqual(expected, Buffer.from(v, 'hex'))), 'INVALID_SIGNATURE', 'Signature invalide.');
}
