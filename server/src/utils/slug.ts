import crypto from 'crypto';

export function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 16) || 'event';
  const suffix = crypto.randomBytes(3).toString('hex').slice(0, 4);
  return `${base}-${suffix}`;
}

export function generateTempCode(): string {
  // 6-digit numeric temporary code
  return Math.floor(100000 + Math.random() * 900000).toString();
}
