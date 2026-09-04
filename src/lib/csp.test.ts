import { describe, it, expect } from 'vitest'
import { buildCsp } from './csp'

// Verifies the exact policy string for the production shape (absolute API URL,
// no separate workflow engine yet) matches what index.html should ship.
describe('buildCsp', () => {
  it('builds the full policy with self plus the measured hosts', () => {
    const policy = buildCsp({ VITE_API_URL: 'https://api.koiosmatch.nl/api' })
    expect(policy).toBe(
      [
        "default-src 'self'",
        "script-src 'self' https://connect.facebook.net",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://api.koiosmatch.nl",
        "font-src 'self' https://fonts.gstatic.com",
        "connect-src 'self' https://api.pdok.nl https://graph.facebook.com blob: https://api.koiosmatch.nl",
        "frame-src https://staticxx.facebook.com https://www.facebook.com",
        "object-src 'none'",
        "base-uri 'self'",
      ].join('; '),
    )
  })

  // Regression for the CSP-1 REJECT: pdf.js fetches the blob: URL DocPreviewModal
  // builds for a PDF preview (PdfPreview.tsx:68 getDocument({ url: blobUrl })) —
  // without blob: in connect-src, Chrome blocks that fetch and every in-app PDF
  // preview (CV, documents, propose-flow) silently falls through to
  // documents.previewUnavailable.
  it('includes blob: in connect-src for the pdf.js DocPreviewModal fetch', () => {
    const policy = buildCsp({ VITE_API_URL: 'https://api.koiosmatch.nl/api' })
    expect(policy).toContain("connect-src 'self' https://api.pdok.nl https://graph.facebook.com blob:")
  })

  it('adds the workflow-engine origin when it differs from the API origin', () => {
    const policy = buildCsp({
      VITE_API_URL: 'https://api.koiosmatch.nl/api',
      VITE_WORKFLOW_API_URL: 'https://workflow.koiosmatch.nl/api',
    })
    expect(policy).toContain('https://api.koiosmatch.nl https://workflow.koiosmatch.nl')
  })

  it('skips a relative VITE_API_URL (dev proxy shape) — it already resolves against self', () => {
    const policy = buildCsp({ VITE_API_URL: '/api' })
    expect(policy).toBe(
      [
        "default-src 'self'",
        "script-src 'self' https://connect.facebook.net",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "img-src 'self' data: blob: https://*.tile.openstreetmap.org",
        "font-src 'self' https://fonts.gstatic.com",
        "connect-src 'self' https://api.pdok.nl https://graph.facebook.com blob:",
        "frame-src https://staticxx.facebook.com https://www.facebook.com",
        "object-src 'none'",
        "base-uri 'self'",
      ].join('; '),
    )
  })

  it('de-duplicates origins shared by API and CSRF URLs', () => {
    const policy = buildCsp({
      VITE_API_URL: 'https://api.koiosmatch.nl/api',
      VITE_CSRF_URL: 'https://api.koiosmatch.nl/sanctum/csrf-cookie',
    })
    expect(policy).toContain(
      "connect-src 'self' https://api.pdok.nl https://graph.facebook.com blob: https://api.koiosmatch.nl",
    )
    expect(policy.match(/api\.koiosmatch\.nl/g)?.length).toBe(2) // once in connect-src, once in img-src
  })
})
