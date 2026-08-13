/**
 * DashboardSwitcher — DASHBOARD-KIEZER-1: the dropdown options list must be exactly
 * what the caller passes (switcherTypes(hasPlanning) upstream in DashboardLayout),
 * proving admin/sales/readonly never surface as manually-chooseable options and a
 * gated 'planning' does when passed in.
 */
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
// Importing the real i18n runtime initializes it (side-effect import) — mirrors
// how the app itself boots translations; no provider wrapper needed (singleton).
import i18n from '@/i18n'
import DashboardSwitcher from './DashboardSwitcher'
import { switcherTypes } from './templates'

const label = (id: string) => i18n.t(`types.${id}`, { ns: 'dashboard' })

describe('DashboardSwitcher', () => {
  it('shows the cleaned-up chooser list — no admin/sales/readonly, planning gated on', () => {
    render(<DashboardSwitcher value="management" options={switcherTypes(true)} onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: i18n.t('switcher.label', { ns: 'dashboard' }) }))
    expect(screen.queryByText(label('admin'))).not.toBeInTheDocument()
    expect(screen.queryByText(label('sales'))).not.toBeInTheDocument()
    expect(screen.queryByText(label('readonly'))).not.toBeInTheDocument()
    expect(screen.getByText(label('planning'))).toBeInTheDocument()
  })

  it('hides planning when the tenant lacks the module', () => {
    render(<DashboardSwitcher value="management" options={switcherTypes(false)} onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: i18n.t('switcher.label', { ns: 'dashboard' }) }))
    expect(screen.queryByText(label('planning'))).not.toBeInTheDocument()
  })

  it('renders the recruitment_manager option with its own label', () => {
    render(<DashboardSwitcher value="management" options={switcherTypes(true)} onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: i18n.t('switcher.label', { ns: 'dashboard' }) }))
    expect(screen.getByText(label('recruitment_manager'))).toBeInTheDocument()
  })
})
