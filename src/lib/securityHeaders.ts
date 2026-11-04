/**
 * securityHeaders — the response headers every static host of this product must send (ONIX L-004 /
 * L-002; the hosting recipe lives in koiosmatch-api/docs/runbooks/HOSTING-HANDOVER.md, row L-004).
 * `frame-ancestors` cannot travel in the <meta> CSP that csp.ts builds (the spec ignores it there), so
 * clickjacking protection is a RESPONSE header. The Vite dev and preview servers of the admin app and of
 * the career site send exactly this set, so the iframe check (L2 check 8) can be rehearsed locally and
 * dev can never drift from what production must send. HSTS is deliberately absent: it belongs to the
 * TLS host only and must never be sent over plain http (dev).
 * Career site in production: the hosting replaces `'none'` with `'self' <embed_origins>` per bureau
 * (CAREER-EMBED-1, Y-005) read from GET /api/public/{tenant}/site; the dev default stays `'none'`.
 */
export const STATIC_HOST_SECURITY_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  'Content-Security-Policy': "frame-ancestors 'none'",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
})
