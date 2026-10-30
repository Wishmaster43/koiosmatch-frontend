/**
 * notificationText: recruiter lines on KPI rows (FOLLOW-UP-2910-1 item 4).
 * Expectations are read through the real i18n instance, never Dutch literals.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import i18n, { ready } from '@/i18n'
import { notificationText } from './notificationText'
import type { AppNotification } from '@/hooks/useNotifications'

beforeAll(async () => { await ready })

const row = (type: string, params?: Record<string, unknown>, meta: Record<string, unknown> = { kpi: 'placements_target' }): AppNotification =>
  ({
    id: 1, seen: false, title: 'SERVER TITLE', body: 'SERVER BODY',
    title_key: `notifications.${type}.title`, body_key: `notifications.${type}.body`, params, meta,
  } as unknown as AppNotification)

const t = i18n.t.bind(i18n)

describe('notificationText recruiters', () => {
  it('joins the recruiter lines into the below_target body', () => {
    const { body } = notificationText(row('kpi.below_target', { label: 'L', value: 1, target: 2, period: '2026-09', recruiters: ['A: 0 / 20', 'B: 1 / 20'] }), t)
    expect(body).toContain('A: 0 / 20\nB: 1 / 20')
  })

  it('renders an empty string when recruiters are absent, never a raw placeholder', () => {
    const { body } = notificationText(row('kpi.below_target', { label: 'L', value: 1, target: 2, period: '2026-09' }), t)
    expect(body).not.toContain('{{')
    expect(body).not.toContain('recruiters')
  })

  it('resolves kpi.recruiter_below_target title and body without rewriting it', () => {
    const { title, body } = notificationText(row('kpi.recruiter_below_target', { target: 20, period: '2026-09', recruiters: ['A: 0 / 20'] }), t)
    expect(title).toBe(i18n.t('kpi.recruiter_below_target.title', { ns: 'notifications' }))
    expect(title).not.toBe('SERVER TITLE')
    expect(body).toContain('A: 0 / 20')
    expect(body).not.toBe('SERVER BODY')
  })

  it('keeps the recruiter type even for a maximum KPI', () => {
    const { title } = notificationText(row('kpi.recruiter_below_target', { recruiters: ['A: 9 / 5'] }, { kpi: 'open_tasks_target' }), t)
    expect(title).toBe(i18n.t('kpi.recruiter_below_target.title', { ns: 'notifications' }))
  })
})
