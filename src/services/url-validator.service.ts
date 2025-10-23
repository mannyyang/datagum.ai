/**
 * Article Analyzer - URL Validator Service
 *
 * Epic: Epic 1 - Article Submission & Validation
 * Stories: US-1.1, US-1.3
 *
 * Validates URL format and enforces security restrictions to prevent
 * SSRF attacks and other malicious inputs.
 */

const MAX_URL_LENGTH = 2000

// Private IP ranges (IPv4)
const PRIVATE_IP_PATTERNS = [
  /^127\./,          // Localhost
  /^10\./,           // Private class A
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,  // Private class B
  /^192\.168\./,     // Private class C
  /^169\.254\./,     // Link-local
]

/**
 * Validate URL format and security restrictions
 * Throws error if validation fails
 */
export function validateURL(url: string): void {
  // Check required
  if (!url || !url.trim()) {
    throw new Error('URL is required')
  }

  // Check length
  validateLength(url)

  // Parse URL
  let parsed: URL
  try {
    parsed = new URL(url.trim())
  } catch {
    throw new Error('Please enter a valid URL (e.g., https://example.com/article)')
  }

  // Validate protocol
  validateProtocol(parsed)

  // Check security restrictions
  checkSecurityRestrictions(parsed)
}

/**
 * Validate URL length
 */
function validateLength(url: string): void {
  if (url.length > MAX_URL_LENGTH) {
    throw new Error(`URL must be less than ${MAX_URL_LENGTH} characters`)
  }
}

/**
 * Validate protocol (must be HTTP or HTTPS)
 */
function validateProtocol(url: URL): void {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('URL must use HTTP or HTTPS protocol')
  }
}

/**
 * Check security restrictions (prevent SSRF)
 */
function checkSecurityRestrictions(url: URL): void {
  const hostname = url.hostname.toLowerCase()

  // Check for localhost
  if (hostname === 'localhost' || hostname === '[::1]') {
    throw new Error('Cannot analyze localhost URLs')
  }

  // Check for private IP addresses
  if (isPrivateIP(hostname)) {
    throw new Error('Cannot analyze private IP addresses')
  }
}

/**
 * Check if hostname is a private IP address
 */
function isPrivateIP(hostname: string): boolean {
  // Remove brackets from IPv6
  const cleanHost = hostname.replace(/^\[|\]$/g, '')

  // Check IPv4 private ranges
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(cleanHost)) {
      return true
    }
  }

  // Check IPv6 localhost
  if (cleanHost === '::1' || cleanHost.startsWith('fe80:')) {
    return true
  }

  return false
}

/**
 * Sanitize URL (trim whitespace and normalize)
 */
export function sanitizeURL(url: string): string {
  return url.trim()
}
