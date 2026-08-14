/**
 * VacancyCandidateTabSettings — leads-criteria block (LEADS-CRITERIA-1).
 * §13: assert the REQUEST (settings POST body), never only that a callback
 * fired — toggling one boolean must persist the FULL merged object so no
 * sibling key (radius/function_match/…) is silently dropped, the days input
 * clamps before persisting, and turning apply_radius off really disables the
 * radius input (a real `disabled` attribute, not just a visual dim).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import VacancyCandidateTabSettings from './VacancyCandidateTabSettings'

// Real translations (no i18n provider in this render tree, so t() would
// otherwise just echo the key) — mirrors ProposalSettings.test.jsx's pattern.
const t = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

// Route the shared settings loader: the blob is controlled per test; saves go
// through the REAL saveSettingsKeys so the api.post seam is asserted.
const blobRef = vi.hoisted(() => ({ current: {} }))
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual('@/lib/settings/useAllSettings')
  return { ...actual, useAllSettings: () => blobRef.current }
})
const postMock = vi.hoisted(() => vi.fn(() => Promise.resolve({ data: {} })))
// getActiveTenantId is the real (unmocked) useAllSettings module's tenant-scope key.
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(() => new Promise(() => {})), post: postMock },
  getActiveTenantId: vi.fn(() => null),
}))

// One fixed deployability-status + contract-form lookup (mirrors
// CandidateSearchTab.test.tsx's mocking shape) — this screen's own vacancy
// statuses come from VacancyLookupsProvider's synchronous seed default
// (open/online/concept/paused/closed), so no mock needed there.
vi.mock('@/context/LookupsContext', () => ({
  useLookups: () => ({
    /* eslint-disable no-restricted-syntax -- seed DATA mirroring the DEFAULT_* seeds, not a UI colour choice */
    statuses: [{ value: 'available', label: 'Beschikbaar', color: '#79B58E' }],
    candidateTypes: [{ value: 'temp_agency', label: 'Uitzendkracht', color: '#DDA071' }],
    /* eslint-enable no-restricted-syntax */
  }),
}))

afterEach(() => { vi.clearAllMocks(); blobRef.current = {} })

// A fully-specified stored config — every leads-criteria key present, so a
// persist() call that drops one would be caught by the exact-body assertion.
const STORED = {
  vacancy_statuses: ['open'],
  candidate_statuses: ['available'],
  contract_forms: [],
  default_radius_km: 25,
  countable_vacancy_statuses: [],
  apply_radius: true,
  function_match: 'exact',
  exclude_already_applied: true,
  include_expiring_placements: true,
  expiring_within_days: 30,
}

describe('VacancyCandidateTabSettings — leads criteria', () => {
  it('toggling include_expiring_placements POSTs the FULL merged object, no sibling key lost', async () => {
    blobRef.current = { vacancy_candidate_tab: JSON.stringify(STORED) }
    const user = userEvent.setup()
    render(<VacancyCandidateTabSettings />)
    // SETTINGS-SUBTABS-1: this control now lives under its own sub-tab.
    await user.click(screen.getByRole('tab', { name: t('candidateTab.leadsCriteria.excludeAlreadyAppliedLabel') }))
    await user.click(screen.getByRole('switch', { name: t('candidateTab.leadsCriteria.includeExpiringPlacementsLabel') }))
    expect(postMock).toHaveBeenCalledWith('/settings', {
      vacancy_candidate_tab: JSON.stringify({ ...STORED, include_expiring_placements: false }),
    })
  })

  it('the expiring-within-days input clamps an out-of-range value before persisting', async () => {
    blobRef.current = { vacancy_candidate_tab: JSON.stringify(STORED) }
    const user = userEvent.setup()
    render(<VacancyCandidateTabSettings />)
    await user.click(screen.getByRole('tab', { name: t('candidateTab.leadsCriteria.excludeAlreadyAppliedLabel') }))
    const daysInput = screen.getByLabelText(t('candidateTab.leadsCriteria.expiringWithinDaysLabel'))
    // A single change event (not user.type — this input is fully controlled by
    // the stored blob, which this mock never reflects back, so per-keystroke
    // typing would fight the unchanged `value` prop between keystrokes).
    fireEvent.change(daysInput, { target: { value: '9999' } })
    expect(postMock).toHaveBeenCalledWith('/settings', {
      vacancy_candidate_tab: JSON.stringify({ ...STORED, expiring_within_days: 365 }),
    })
  })

  it('clicking apply_radius off POSTs the full merged object with apply_radius: false', async () => {
    blobRef.current = { vacancy_candidate_tab: JSON.stringify(STORED) }
    const user = userEvent.setup()
    render(<VacancyCandidateTabSettings />)
    await user.click(screen.getByRole('tab', { name: t('candidateTab.leadsCriteria.title') }))
    expect(screen.getByLabelText(t('candidateTab.defaultRadiusLabel'))).not.toBeDisabled()
    await user.click(screen.getByRole('switch', { name: t('candidateTab.leadsCriteria.applyRadiusLabel') }))
    expect(postMock).toHaveBeenCalledWith('/settings', {
      vacancy_candidate_tab: JSON.stringify({ ...STORED, apply_radius: false }),
    })
  })

  it('apply_radius: false renders the radius input with a real disabled attribute', async () => {
    blobRef.current = { vacancy_candidate_tab: JSON.stringify({ ...STORED, apply_radius: false }) }
    const user = userEvent.setup()
    render(<VacancyCandidateTabSettings />)
    await user.click(screen.getByRole('tab', { name: t('candidateTab.leadsCriteria.title') }))
    expect(screen.getByLabelText(t('candidateTab.defaultRadiusLabel'))).toBeDisabled()
  })

  it('renders the honest caveat note on the function_match "category" option', async () => {
    blobRef.current = { vacancy_candidate_tab: JSON.stringify(STORED) }
    const user = userEvent.setup()
    render(<VacancyCandidateTabSettings />)
    await user.click(screen.getByRole('tab', { name: t('candidateTab.leadsCriteria.title') }))
    expect(screen.getByText(t('candidateTab.leadsCriteria.functionMatchCategoryNote'))).toBeInTheDocument()
  })
})
