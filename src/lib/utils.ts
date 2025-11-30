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
