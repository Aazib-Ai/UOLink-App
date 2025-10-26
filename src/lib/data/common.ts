export function toTitleCase(str: string) {
  return str.replace(/\w\S*/g, function (txt) {
    return txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase();
  });
}

export function normalizeForStorage(str: string) {
  return str.trim().toLowerCase();
}

export function slugify(str: string) {
  return str
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export const toNumber = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? value : 0;

export const clampNonNegative = (value: number): number => (value < 0 ? 0 : value);

export const readString = (value: unknown): string | undefined =>
    typeof value === 'string' && value.trim().length > 0 ? value : undefined;

export const readNumber = (value: unknown): number | undefined =>
    typeof value === 'number' && Number.isFinite(value) ? value : undefined;