import crypto from 'crypto';

/**
 * Generates a cryptographically secure random token
 * @returns A 32-character URL-safe alphanumeric string
 */
export function generateSecureToken(): string {
  // Generate 24 random bytes (will become 32 characters in base64url)
  const buffer = crypto.randomBytes(24);
  
  // Convert to URL-safe base64 (replace +/= with -_)
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Validates that a token matches the expected format
 * @param token The token to validate
 * @returns True if the token is valid format
 */
export function isValidTokenFormat(token: string): boolean {
  // Should be 32 characters of URL-safe base64
  return /^[A-Za-z0-9_-]{32}$/.test(token);
}

