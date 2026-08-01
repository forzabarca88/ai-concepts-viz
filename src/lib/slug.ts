/**
 * Convert a string to a URL-friendly slug.
 * Lowercases the input, replaces spaces with hyphens, and removes special characters.
 */
export function toSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Map of content slugs to their parent section.
 */
export const SLUG_SECTION_MAP: Record<string, string> = {
  data: 'core',
  tokenization: 'core',
  parameters: 'core',
  'pre-training': 'training',
  sft: 'training',
  'preference-tuning': 'training',
};

/**
 * Get the section a slug belongs to, or 'other' if not mapped.
 */
export function getSectionForSlug(slug: string): string {
  return SLUG_SECTION_MAP[slug] ?? 'other';
}
