/**
 * ReportDataWindow — regression: `windowKey` used to be a dead ternary where
 * both branches were byte-identical (`isLeads ? x : x`), so the prop drove no
 * behaviour at all. The window label always resolves via `reportKey` alone.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReportDataWindow } from './ReportDataWindow'

// DATETIME-IMPORT-LES (CLAUDE.md §2): ReportCompareMetric (imported here even
// when unused) pulls in lib/datetime's real i18n side-effect import — a bare
// react-i18next mock without initReactI18next crashes it.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}))

describe('ReportDataWindow · windowKey resolves from reportKey alone', () => {
  it('uses `${reportKey}.window` regardless of isLeads', () => {
    render(<ReportDataWindow from="2026-01-01" to="2026-01-31" reportKey="leads" isLeads />)
    expect(screen.getByText('leads.window')).toBeInTheDocument()
  })

  it('resolves the same way when isLeads is false/omitted', () => {
    render(<ReportDataWindow from="2026-01-01" to="2026-01-31" reportKey="candidates" />)
    expect(screen.getByText('candidates.window')).toBeInTheDocument()
  })
})
