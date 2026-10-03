/**
 * Log redaction utility directly ported from core Redactor.kt.
 *
 * Rules.md §26 & Architecture.md §31:
 * No tokens, no client secrets, no file names in logs, no full URIs,
 * and email addresses masked to domain only in production logs.
 */

const TOKEN_PATTERNS = [
  /ya29\.[A-Za-z0-9._-]{10,}/g,
  /1\/\/[A-Za-z0-9._-]{20,}/g,
  /GOCSPX-[A-Za-z0-9_-]{10,}/g,
];

const TAG_WIDTH = 12;

export const Redactor = {
  /**
   * Generates a 12-character hex correlation tag via FNV-1a hash of accountId and fileId.
   */
  fileRefTag(accountId: number, fileId: string): string {
    const combined = `${accountId}\u0000${fileId}`;
    let hash = BigInt('14695981039346656037'); // FNV offset basis (64-bit unsigned)
    const prime = BigInt('1099511628211'); // FNV prime

    for (let i = 0; i < combined.length; i++) {
      hash ^= BigInt(combined.charCodeAt(i));
      hash = (hash * prime) & BigInt('0xFFFFFFFFFFFFFFFF');
    }

    const hex = hash.toString(16).padStart(16, '0');
    return hex.slice(-TAG_WIDTH);
  },

  /**
   * Masks secrets preserving only the last 4 characters.
   */
  maskSecret(secret: string | null | undefined): string {
    if (secret === null || secret === undefined) return '<null>';
    if (secret === '') return '<empty>';
    if (secret.length <= 5) return '<redacted>';
    return `<redacted:${secret.slice(-4)}>`;
  },

  /**
   * Strips URI down to scheme and authority.
   */
  maskUri(uri: string | null | undefined): string {
    if (!uri) return '<null>';
    const schemeEnd = uri.indexOf('://');
    if (schemeEnd < 0) return '<uri>';
    const authorityStart = schemeEnd + 3;
    const pathStart = uri.indexOf('/', authorityStart);
    return pathStart < 0 ? uri : `${uri.substring(0, pathStart)}/<redacted>`;
  },

  /**
   * Masks an email address to its domain.
   */
  maskEmail(email: string | null | undefined): string {
    if (!email || email.trim() === '') return '<none>';
    const at = email.indexOf('@');
    if (at < 0) return '<redacted>';
    return `<redacted>@${email.substring(at + 1)}`;
  },

  /**
   * Scrubbing tokens from free-form text.
   */
  scrub(message: string): string {
    let result = message;
    for (const pattern of TOKEN_PATTERNS) {
      result = result.replace(pattern, '<redacted-token>');
    }
    return result;
  },
};
