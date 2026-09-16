/**
 * OutreachList — the "Koios" column (Danny 05-08 consistency pass). The honest
 * per-row rule lives in data/campaignAdvice.test.ts; this is the smoke test
 * proving the shared header/cell render in the actual table.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import OutreachList from './OutreachList'
import type { Campaign } from './hooks/useOutreachCampaigns'

vi.mock('@/lib/settings/useAllSettings', () => ({
  useAllSettings: () => ({}),
  getBoolSetting: (_s: unknown, _key: string, fallback: boolean) => fallback,
}))
vi.mock('@/lib/datetime', () => ({
  useDateFormat: () => ({ formatDate: (v: unknown) => (v == null ? '—' : String(v)) }),
  // useNumberFormat (GETALLEN-1) reads the active locale from the same module.
  useLocale: () => 'nl-NL',
}))
import '@/i18n'

const baseCampaign: Campaign = {
  id: 'c1', name: 'Voorjaarsactie', channel: 'call', status: 'draft',
  targets_count: 0, created_at: '2026-01-01', owner: null,
}

// GETALLEN-1: the targets count renders through the house number formatter
// (nl thousands separator), never a raw JS number.
describe('OutreachList · targets count (GETALLEN-1)', () => {
  it('renders a large targets count with the nl-NL thousands separator', () => {
    const many = { ...baseCampaign, id: 'c4', targets_count: 1200 }
    render(<OutreachList campaigns={[many]} loading={false} error={false} onReload={() => {}} />)
    expect(screen.getByText('1.200')).toBeInTheDocument()
    expect(screen.queryByText('1200')).toBeNull()
  })

  it('falls back to a dash when the count is absent', () => {
    const none = { ...baseCampaign, id: 'c5', targets_count: undefined, target_count: undefined }
    render(<OutreachList campaigns={[none]} loading={false} error={false} onReload={() => {}} />)
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })
})

describe('OutreachList · Koios column (Danny 05-08)', () => {
  it('renders the header with the Koios mark, and flags an active campaign with zero targets', () => {
    const active = { ...baseCampaign, id: 'c2', status: 'active', targets_count: 0 }
    render(<OutreachList campaigns={[active]} loading={false} error={false} onReload={() => {}} />)

    expect(screen.getByRole('img', { name: 'Koios AI' })).toBeInTheDocument()
    expect(screen.getByText('Aandacht')).toBeInTheDocument()
  })

  it('renders an honest dash for an active campaign that already has targets', () => {
    const active = { ...baseCampaign, id: 'c3', status: 'active', targets_count: 12 }
    const { container } = render(<OutreachList campaigns={[active]} loading={false} error={false} onReload={() => {}} />)
    const headerCell = screen.getByRole('img', { name: 'Koios AI' }).closest('th') as HTMLElement
    const col = Array.from(headerCell.parentElement?.children ?? []).indexOf(headerCell)
    expect(container.querySelectorAll('tbody tr')[0].children[col].textContent).toBe('—')
  })
})
