import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function toTitleCase(str: string) {
  // Split by spaces only to preserve special characters like &
  return str.split(' ').map(word => {
    if (!word) return word;
    return word.charAt(0).toUpperCase() + word.substring(1).toLowerCase();
  }).join(' ');
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

export function decodeHtmlEntities(str: string): string {
  if (!str) return str;
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&#x27;': "'",
    '&nbsp;': ' ',
  };
  return str.replace(/&[#a-zA-Z0-9]+;/g, (match) => {
    if (entities[match]) return entities[match];
    // Handle numeric entities
    if (match.startsWith('&#')) {
      const code = match.substring(2, match.length - 1);
      if (code.startsWith('x')) {
        const charCode = parseInt(code.substring(1), 16);
        return !isNaN(charCode) ? String.fromCharCode(charCode) : match;
      }
      const charCode = parseInt(code, 10);
      return !isNaN(charCode) ? String.fromCharCode(charCode) : match;
    }
    return match;
  });
}
