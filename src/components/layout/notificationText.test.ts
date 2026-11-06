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

  // ARCHIVED-REAPPLY-1 (BE 20ab3dc1): the new application.reapplied_restored type has a
  // catalogue title in every FE locale, so the viewer reads it in their own language and
  // never the bureau-language server literal; it carries no body in the catalogue, so the
  // body half honestly falls back to the (empty) server body.
  it('translates the application.reapplied_restored title from the catalogue', () => {
    const n = {
      id: 4, seen: false, title: 'SERVER TITLE', body: null,
      title_key: 'notifications.application.reapplied_restored.title',
      body_key: 'notifications.application.reapplied_restored.body',
      params: {},
    } as unknown as AppNotification
    const { title, body } = notificationText(n, i18n.t.bind(i18n))
    expect(title).toBe('Gearchiveerde kandidaat hersteld door nieuwe sollicitatie')
    expect(body).toBe('')
  })

  // NOTIF-LANG-GAPS-1: a connector.limit_warning_reached row renders the catalogue title with its label.
  it('translates connector.limit_warning_reached with the label param', () => {
    const n = {
      id: 6, seen: false, title: 'SERVER TITLE', body: null,
      title_key: 'notifications.connector.limit_warning_reached.title',
      body_key: 'notifications.connector.limit_warning_reached.body',
      params: { label: 'HelloFlex' },
    } as unknown as AppNotification
    const { title } = notificationText(n, i18n.t.bind(i18n))
    expect(title).toBe('Limiet bereikt: HelloFlex')
  })

  // Regression: a kpi.below_target row renders the FE catalogue sentence with its params filled, not the server literal.
  it('translates kpi.below_target title and body with their params', () => {
    const n = {
      id: 5, seen: false, title: 'SERVER TITLE', body: 'SERVER BODY',
      title_key: 'notifications.kpi.below_target.title',
      body_key: 'notifications.kpi.below_target.body',
      params: { label: 'Nieuwe kandidaten', value: '12', target: '15', period: '2026-09' },
    } as unknown as AppNotification
    const { title, body } = notificationText(n, i18n.t.bind(i18n))
    expect(title).not.toBe('SERVER TITLE')
    expect(body).not.toBe('SERVER BODY')
    expect(title).toContain('Nieuwe kandidaten')
    expect(body).toBe('Nieuwe kandidaten stond op 12 bij een doel van 15 (september 2026).')
    expect(body).not.toMatch(/\{\{/)
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

describe('notificationText · kpi.below_target period', () => {
  const row = (period: string) => ({
    id: 9, seen: false, title: 'S', body: 'SERVER BODY',
    title_key: 'notifications.kpi.below_target.title', body_key: 'notifications.kpi.below_target.body',
    params: { label: 'Gesprekken', value: '3', target: '5', period },
  }) as unknown as AppNotification

  it('renders a daily period as DD-MM-YYYY, never ISO', () => {
    const { body } = notificationText(row('2026-10-22'), i18n.t.bind(i18n))
    expect(body).toContain('(22-10-2026)')
    expect(body).not.toContain('2026-10-22')
  })

  it('renders a monthly period as a localized month and year', () => {
    const { body } = notificationText(row('2026-09'), i18n.t.bind(i18n))
    expect(body).not.toContain('(2026-09)')
    expect(body).toMatch(/september 2026/i)
  })

  it('passes a non-date param through unchanged', () => {
    const { body } = notificationText(row('2026-09'), i18n.t.bind(i18n))
    expect(body).toContain('Gesprekken')
  })

  // Builds a keyed row for the NOTIF-COPY-1 cases.
  const keyed = (type: string, params?: Record<string, unknown>) => ({
    id: 9, seen: false, title: 'SERVER TITLE', body: 'SERVER BODY',
    title_key: `notifications.${type}.title`, body_key: `notifications.${type}.body`, params: params ?? {},
  } as unknown as AppNotification)

  it('renders retention.entity_erase_blocked when the BE stamps the catalogue keys and params', () => {
    const { body } = notificationText(keyed('retention.entity_erase_blocked', { entity: 'Klant A', labels: 'vacatures' }), i18n.t.bind(i18n))
    expect(body).toBe(i18n.t('notifications:retention.entity_erase_blocked.body', { entity: 'Klant A', labels: 'vacatures', lng: 'nl' }))
  })

  it('falls back to the server text when a param is missing, never showing {{entity}}', () => {
    const { body } = notificationText(keyed('retention.entity_erase_blocked'), i18n.t.bind(i18n))
    expect(body).toBe('SERVER BODY')
    expect(body).not.toContain('{{')
  })

  it('picks the singular and plural stale_digest title on count', () => {
    const t = i18n.t.bind(i18n)
    expect(notificationText(keyed('workflow.stale_digest', { count: 1 }), t).title).toBe(i18n.t('notifications:workflow.stale_digest.title', { count: 1, lng: 'nl' }))
    expect(notificationText(keyed('workflow.stale_digest', { count: 3 }), t).title).toBe(i18n.t('notifications:workflow.stale_digest.title', { count: 3, lng: 'nl' }))
  })

  it('renders invoice.unconfirmed with the invoice number', () => {
    const { body } = notificationText(keyed('invoice.unconfirmed', { number: 'F-2026-7' }), i18n.t.bind(i18n))
    expect(body).toBe(i18n.t('notifications:invoice.unconfirmed.body', { number: 'F-2026-7', lng: 'nl' }))
  })

  it('null keys show the server text even when the FE carries copy for the type', () => {
    const n = { id: 10, seen: false, title: 'SERVER TITLE', body: 'SERVER BODY', type: 'email.mailbox_needs_reconnect', title_key: null, body_key: null } as unknown as AppNotification
    expect(notificationText(n, i18n.t.bind(i18n))).toEqual({ title: 'SERVER TITLE', body: 'SERVER BODY' })
  })

  it('keeps the server text for an unknown type with null keys', () => {
    const n = { id: 11, seen: false, title: 'SERVER TITLE', body: 'SERVER BODY', type: 'made.up_type', title_key: null, body_key: null } as unknown as AppNotification
    const r = notificationText(n, i18n.t.bind(i18n))
    expect(r).toEqual({ title: 'SERVER TITLE', body: 'SERVER BODY' })
  })

  it('lets a stamped title_key win', () => {
    const n = { id: 12, seen: false, title: 'SERVER TITLE', body: 'SERVER BODY', type: 'email.mailbox_needs_reconnect', title_key: 'notifications.candidate.phase_stale.title', body_key: null } as unknown as AppNotification
    expect(notificationText(n, i18n.t.bind(i18n)).title).toBe(i18n.t('notifications:candidate.phase_stale.title', { lng: 'nl' }))
  })
})
