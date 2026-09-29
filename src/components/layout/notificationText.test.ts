/**
 * notificationText — key-present/translated, key-missing/server-fallback,
 * free-typed-row/server-text behaviour (NOTIF-I18N-1).
 */
import { describe, it, expect, beforeAll } from 'vitest'
import i18n, { ready } from '@/i18n'
import { notificationText } from './notificationText'
import type { AppNotification } from '@/hooks/useNotifications'

beforeAll(async () => { await ready })

describe('notificationText', () => {
  it('translates via title_key/body_key with params when the key exists in the active locale', async () => {
    await ready
    const n = {
      id: 1, seen: false,
      // Deliberately DIFFERENT from the catalogue value, so the assertion below
      // can only pass via the translated path, never the server-fallback path
      // (verifier fix, 29-09: the original server text equalled the catalogue
      // text, so the test passed even when resolveHalf silently fell back).
      title: 'SERVER TITLE', body: 'SERVER BODY',
      title_key: 'notifications.candidate.phase_stale.title',
      body_key: 'notifications.candidate.phase_stale.body',
      params: { phase: 'Lead', days: 5 },
    } as unknown as AppNotification
    const { title, body } = notificationText(n, i18n.t.bind(i18n))
    // Default test locale is nl (§ ready loads only the eager nl fallback).
    expect(title).toBe('Lead staat stil')
    expect(body).toBe('Deze lead staat al 5 werkdagen in fase Lead, zonder geplande afspraak of openstaande taak.')
  })

  it('falls back to the server title/body when the key does not exist in the active locale', () => {
    const n = {
      id: 2, seen: false, title: 'Server title', body: 'Server body',
      title_key: 'notifications.unknown.made_up.title', body_key: 'notifications.unknown.made_up.body',
      params: {},
    } as unknown as AppNotification
    const { title, body } = notificationText(n, i18n.t.bind(i18n))
    expect(title).toBe('Server title')
    expect(body).toBe('Server body')
  })

  it('renders the server text verbatim for a free-typed row (no title_key/body_key)', () => {
    const n = {
      id: 3, seen: false, title: 'Free typed title', body: 'Free typed body',
      title_key: null, body_key: null, params: {},
    } as unknown as AppNotification
    const { title, body } = notificationText(n, i18n.t.bind(i18n))
    expect(title).toBe('Free typed title')
    expect(body).toBe('Free typed body')
  })
})
