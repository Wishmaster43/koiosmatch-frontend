/**
 * L-004-DEV-1: the static-host security headers are one shared constant, and both Vite configs (admin app
 * and career site) send it from their dev AND preview servers, so a local iframe check measures the same
 * policy production must send.
 */
import { describe, it, expect } from 'vitest'
import { STATIC_HOST_SECURITY_HEADERS } from './securityHeaders'

// Both Vite configs live at the repo root, outside the `@/` alias, so this gate reads them by their
// cwd-relative path through a locally-typed require (the tokenContrast gate's idiom; this tsconfig
// carries no @types/node and a `../../` import would trip the deep-relative-import rule).
declare const require: (m: string) => unknown
const { readFileSync } = require('fs') as { readFileSync: (p: string, e: string) => string }
const adminConfig: string = readFileSync('vite.config.js', 'utf8')
const careerConfig: string = readFileSync('careersite/vite.config.ts', 'utf8')

describe('STATIC_HOST_SECURITY_HEADERS', () => {
  it('carries exactly the four headers of the hosting recipe, with frame-ancestors none', () => {
    expect(Object.keys(STATIC_HOST_SECURITY_HEADERS).sort()).toEqual([
      'Content-Security-Policy', 'Referrer-Policy', 'X-Content-Type-Options', 'X-Frame-Options',
    ])
    expect(STATIC_HOST_SECURITY_HEADERS['Content-Security-Policy']).toBe("frame-ancestors 'none'")
    expect(STATIC_HOST_SECURITY_HEADERS['X-Frame-Options']).toBe('DENY')
    expect(STATIC_HOST_SECURITY_HEADERS['X-Content-Type-Options']).toBe('nosniff')
    expect(STATIC_HOST_SECURITY_HEADERS['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
  })

  it('never carries HSTS (a TLS-host header that must not be sent over plain http in dev)', () => {
    expect(Object.keys(STATIC_HOST_SECURITY_HEADERS).some(k => /strict-transport/i.test(k))).toBe(false)
  })

  it('is sent by the admin dev server and preview server (vite.config.js)', () => {
    const src = adminConfig
    expect(src).toMatch(/import \{ STATIC_HOST_SECURITY_HEADERS \} from '\.\/src\/lib\/securityHeaders\.ts'/)
    expect(src).toMatch(/server:\s*\{[\s\S]*?headers: STATIC_HOST_SECURITY_HEADERS/)
    expect(src).toMatch(/preview:\s*\{\s*headers: STATIC_HOST_SECURITY_HEADERS/)
  })

  it('is sent by the career-site dev server and preview server (careersite/vite.config.ts)', () => {
    const src = careerConfig
    expect(src).toMatch(/import \{ STATIC_HOST_SECURITY_HEADERS \} from '\.\.\/src\/lib\/securityHeaders\.ts'/)
    expect(src).toMatch(/server:\s*\{[^}]*headers: STATIC_HOST_SECURITY_HEADERS/)
    expect(src).toMatch(/preview:\s*\{\s*headers: STATIC_HOST_SECURITY_HEADERS/)
  })
})
