export class AppError extends Error {
  code: string; status: number; details?: unknown;
  constructor(code: string, message: string, status = 400, details?: unknown) {
    super(message); this.name = 'AppError'; this.code = code; this.status = status; this.details = details;
  }
}
export function invariant(condition: unknown, code: string, message: string, status = 400): asserts condition {
  if (!condition) throw new AppError(code, message, status);
}
export function object(value: unknown): Record<string, unknown> {
  invariant(value !== null && typeof value === 'object' && !Array.isArray(value), 'INVALID_OBJECT', 'Objet JSON attendu.');
  return value as Record<string, unknown>;
}
export function text(value: unknown, name: string, max = 8000): string {
  invariant(typeof value === 'string' && value.trim().length > 0 && value.length <= max,
    'INVALID_FIELD', `Champ invalide : ${name}.`);
  return value.trim();
}
export function uuid(value: unknown): string {
  const v = text(value, 'id', 36);
  invariant(/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v), 'INVALID_ID', 'Identifiant invalide.');
  return v;
}
