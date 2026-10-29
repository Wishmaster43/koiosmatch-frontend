/**
 * notificationParams — KPI digest, Facebook forms and period params render in the viewer's language.
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import i18n, { ready } from '@/i18n'
import { loadLocale } from '@/i18n/lazyLocales'
import { notificationText } from './notificationText'
import type { AppNotification } from '@/hooks/useNotifications'

beforeAll(async () => {
  await ready
  for (const l of ['en', 'de']) await loadLocale(i18n, l)
})
afterEach(async () => { await i18n.changeLanguage('nl') })

const row = (type: string, params: Record<string, unknown>, meta?: Record<string, unknown>) => ({
  id: 1, seen: false, title: 'SERVER', body: 'SERVER',
  title_key: `notifications.${type}.title`, body_key: `notifications.${type}.body`, params, meta,
}) as unknown as AppNotification
const text = (n: AppNotification) => notificationText(n, i18n.t.bind(i18n))

describe('kpi.below_target', () => {
  it('shows the German label, de number format and a de month, with no ISO key or Dutch label', async () => {
    await i18n.changeLanguage('de')
    const { title, body } = text(row('kpi.below_target',
      { label: 'Nieuwe kandidaten', value: '1.234', target: '1.500', period: '2026-09' },
      { kpi: 'new_candidates_target', value: 1234.6, target: 1500, period: '2026-09' }))
    expect(title).toContain('Neue Kandidaten')
    expect(title).not.toContain('Nieuwe kandidaten')
    expect(body).toContain('1.234')
    expect(body).toContain('1.500')
    expect(body).not.toMatch(/\d{4}-\d{2}/)
  })

  it('floors an at-least KPI, ceils an at-most KPI and renders the rate as a percentage (en)', async () => {
    await i18n.changeLanguage('en')
    const open = text(row('kpi.below_target', { label: 'Open taken', period: '2026-10-22' }, { kpi: 'open_tasks_target', value: 20.2, target: 20, period: '2026-10-22' }))
    expect(open.title).toContain('Open tasks')
    expect(open.body).toContain('21')
    expect(open.body).toContain('22-10-2026')
    const rate = text(row('kpi.below_target', { label: 'x', period: '2026-09' }, { kpi: 'fill_rate_target', value: 84.6, target: 85, period: '2026-09' }))
    expect(rate.body).toContain('84%')
  })

  it('keeps the server label when the row carries no kpi key', async () => {
    await i18n.changeLanguage('en')
    const { title } = text(row('kpi.below_target', { label: 'Server label', value: '1', target: '2', period: '2026-09' }))
    expect(title).toContain('Server label')
  })
})

describe('facebook forms suffix', () => {
  it('rebuilds the suffix from form_ids in the viewer language', async () => {
    await i18n.changeLanguage('en')
    const { body } = text(row('facebook.lead_pending', { count: 2, form_ids: '123, 456', forms: ' Formulieren: 123, 456.' }))
    expect(body).toBe('Facebook leads that have been waiting to be retrieved for over 24 hours: 2. Forms: 123, 456. Check the Facebook connection.')
  })

  it('drops a legacy suffix written in another language', async () => {
    await i18n.changeLanguage('en')
    const { body } = text(row('facebook.lead_pending', { count: 2, forms: ' Formulieren: 123, 456.' }))
    expect(body).not.toContain('Formulieren')
  })

  it('translates lead_archived_candidate instead of the server literal', async () => {
    await i18n.changeLanguage('en')
    const { title } = text(row('facebook.lead_archived_candidate', {}))
    expect(title).toBe('Facebook lead linked to an archived candidate')
  })
})

// KPI-MAX: a ceiling KPI reads "above maximum" even while the BE still sends below_target; a floor KPI keeps below_target.
describe('kpi.above_maximum', () => {
  it('rewrites a below_target row of a maximum KPI to the above-maximum sentence (en)', async () => {
    await i18n.changeLanguage('en')
    const { title, body } = text(row('kpi.below_target', { label: 'x', period: '2026-10-22' }, { kpi: 'open_tasks_target', value: 25.2, target: 20, period: '2026-10-22' }))
    expect(title).toBe('Open tasks is above the maximum')
    expect(body).toContain('maximum of 20')
  })

  it('renders a BE-sent kpi.above_maximum row the same way', async () => {
    await i18n.changeLanguage('en')
    const { title } = text(row('kpi.above_maximum', { label: 'x', period: '2026-10-22' }, { kpi: 'uncalled_warning_threshold', value: 9, target: 5, period: '2026-10-22' }))
    expect(title).toBe('Contacts still to call is above the maximum')
  })

  it('keeps below_target for an at-least KPI', async () => {
    await i18n.changeLanguage('en')
    const { title } = text(row('kpi.below_target', { label: 'x', period: '2026-10-22' }, { kpi: 'new_candidates_target', value: 3, target: 10, period: '2026-10-22' }))
    expect(title).toBe('New candidates is below target')
  })
})
