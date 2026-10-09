/**
 * resolveNotificationHref — the zip-ready notification's click-through is an
 * EXTERNAL signed URL (TRANSFER-FAMILIES ZIP), resolved separately from the
 * {page,id} record model. Pins: only http(s) passes, unknown types stay null.
 */
import { describe, it, expect, vi } from 'vitest'
// Pin a distinct API origin so the API-origin branch is really exercised (the .env uses a relative /api).
vi.mock('@/lib/authMode', () => ({
  isApiOrigin: (u: string) => new URL(u).origin === 'https://api.example.test',
}))

import { resolveNotificationHref } from './notificationTarget'
import type { AppNotification } from '@/hooks/useNotifications'

// The stubbed API origin, distinct from the app origin.
const API_ORIGIN = 'https://api.example.test'

const row = (type: string, meta: Record<string, unknown>): AppNotification =>
  ({ id: 1, type, meta } as unknown as AppNotification)

describe('resolveNotificationHref', () => {
  it('resolves documents.zip_ready to its signed download URL', () => {
    expect(resolveNotificationHref(row('documents.zip_ready', { download_url: `${API_ORIGIN}/dl/abc?sig=x` })))
      .toBe(`${API_ORIGIN}/dl/abc?sig=x`)
  })

  it('refuses a non-http scheme and a missing url', () => {
    expect(resolveNotificationHref(row('documents.zip_ready', { download_url: 'javascript:alert(1)' }))).toBeNull()
    expect(resolveNotificationHref(row('documents.zip_ready', {}))).toBeNull()
  })

  it('stays null for every other notification type', () => {
    expect(resolveNotificationHref(row('opportunity.won', { download_url: 'https://x.test/y' }))).toBeNull()
  })
})

// ONIX M-001: only the API origin and the app's own origin may be opened.
describe('resolveNotificationHref origin gate (M-001)', () => {
  it('keeps an API-origin signed URL and an app-origin URL', () => {
    const api = `${API_ORIGIN}/dl/a?sig=1`
    const app = `${window.location.origin}/dl/b`
    expect(resolveNotificationHref(row('documents.zip_ready', { download_url: api }))).toBe(api)
    expect(resolveNotificationHref(row('documents.zip_ready', { download_url: app }))).toBe(app)
  })

  it('keeps a same-app-origin URL while the API origin differs', () => {
    expect(window.location.origin).not.toBe(API_ORIGIN)
    const app = `${window.location.origin}/dl/c?sig=2`
    expect(resolveNotificationHref(row('documents.zip_ready', { download_url: app }))).toBe(app)
  })

  it('drops a foreign https host, a foreign http host and javascript:', () => {
    for (const u of ['https://evil.example/x', 'http://evil.example/x', 'javascript:alert(1)']) {
      expect(resolveNotificationHref(row('documents.zip_ready', { download_url: u }))).toBeNull()
    }
  })
})
