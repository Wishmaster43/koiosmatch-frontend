/**
 * TenantUsageKpiRow — the one component that renders the MARGEGEHEIM fields
 * (purchase/margin, superadmin-only screen): pins that they land in the AI
 * tile's note, and that missing values read as a dash, never a fabricated
 * € 0,00 (Opus round, TENANT-USAGE-POLISH-1).
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import TenantUsageKpiRow from './TenantUsageKpiRow'

// House pattern (see WorkflowHistoryView.test): mock BOTH react-i18next and
// @/i18n — importing the real @/i18n self-initialises i18next as a side effect.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => {
      const vals = o ? Object.entries(o).filter(([kk]) => kk !== 'defaultValue').map(([, v]) => v) : []
      return vals.length ? `${k}:${vals.join('|')}` : k
    },
    i18n: { language: 'nl' },
  }),
}))
vi.mock('@/i18n', () => ({ LOCALE_BY_LANG: { nl: 'nl-NL', en: 'en-GB' } }))

describe('TenantUsageKpiRow', () => {
  it('renders purchase, sale and margin in the AI tile note', () => {
    render(<TenantUsageKpiRow loading={false} usage={{
      ai: { tokens: 13122, requests: 5 },
      billing: { ai: { purchase: 12.34, sale: 19.75, margin: 7.41 } },
      workflow_tokens: { total_module_runs: 1 },
      whatsapp: { business_numbers: 2 },
      planning: { processed_hours: 10 },
    }} />)
    const notes = document.body.textContent ?? ''
    expect(notes).toMatch(/12,34|12.34/)   // purchase in the AI note
    expect(notes).toMatch(/7,41|7.41/)     // margin in the AI note
    expect(notes).toMatch(/19,75|19.75/)   // sale as the tile value
  })

  it('renders a dash for missing money values, never a fabricated zero', () => {
    render(<TenantUsageKpiRow loading={false} usage={{ ai: { tokens: 100 } }} />)
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
    expect(document.body.textContent).not.toMatch(/€\s?0,00/)
  })
})
