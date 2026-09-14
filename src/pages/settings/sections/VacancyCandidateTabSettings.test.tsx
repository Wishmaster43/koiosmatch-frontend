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
const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })

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
    // SETTINGS-SUBTABS-1: this control now lives under its own sub-tab (short
    // tab-bar name since TAB-STRIP-WIDTH-1 — see the bottom describe block).
    await user.click(screen.getByRole('tab', { name: t('candidateTab.tabs.exclusions') }))
    await user.click(screen.getByRole('switch', { name: t('candidateTab.leadsCriteria.includeExpiringPlacementsLabel') }))
    expect(postMock).toHaveBeenCalledWith('/settings', {
      vacancy_candidate_tab: JSON.stringify({ ...STORED, include_expiring_placements: false }),
    })
  })

  it('the expiring-within-days input clamps an out-of-range value before persisting', async () => {
    blobRef.current = { vacancy_candidate_tab: JSON.stringify(STORED) }
    const user = userEvent.setup()
    render(<VacancyCandidateTabSettings />)
    await user.click(screen.getByRole('tab', { name: t('candidateTab.tabs.exclusions') }))
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
    await user.click(screen.getByRole('tab', { name: t('candidateTab.tabs.radius_function') }))
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
    await user.click(screen.getByRole('tab', { name: t('candidateTab.tabs.radius_function') }))
    expect(screen.getByLabelText(t('candidateTab.defaultRadiusLabel'))).toBeDisabled()
  })

  // FUNCTION-MATCH-CATEGORY-1: 'category' left the UI (the write 422s on it);
  // a STORED category value must display as exact — never an optionless control.
  it('offers only exact/all, and a stored "category" value displays as exact', async () => {
    blobRef.current = { vacancy_candidate_tab: JSON.stringify({ ...STORED, function_match: 'category' }) }
    const user = userEvent.setup()
    render(<VacancyCandidateTabSettings />)
    await user.click(screen.getByRole('tab', { name: t('candidateTab.tabs.radius_function') }))
    expect(screen.queryByText(t('candidateTab.leadsCriteria.functionMatchCategory'))).toBeNull()
    expect(screen.getByRole('radio', { name: new RegExp(t('candidateTab.leadsCriteria.functionMatchExact')) })).toBeChecked()
  })
})

// TAB-STRIP-WIDTH-1 (Danny 13-09, verbatim: "de regel van de subtabjes kan
// breeder worden voor de titel"): the tab bar used to reuse each block's long
// descriptive sentence as its label (up to ~50 chars in nl/fr/es), which never
// fit a 720px strip. Fix (F1, Opus review): the tab BAR gets a short 2-3 word
// name per tab; the original long sentence still shows, now as the heading
// INSIDE that tab's own content. Measured (Inter 12px ≈ 6.2px/char + 24px/tab):
// the six short labels fit inside 720px in every locale, so the strip stays
// inside the same 720px container as the rest of the form.
//
// NOTE: jsdom never lays out real pixel widths, so this suite cannot itself
// prove the six SHORT labels fit on one row at 1440px — that real width guard
// belongs in the smoke suite (`tablist.scrollWidth <= tablist.clientWidth` at
// 1440, all 7 locales). This suite only proves the two things it CAN prove:
// the tab bar shows the short names, and the original long sentence is not
// lost — it now renders inside the tab body instead.
describe('VacancyCandidateTabSettings — short tab names, long titles moved in-body (TAB-STRIP-WIDTH-1)', () => {
  it('uses the short tab-bar labels as the tab names, not the long section titles', () => {
    blobRef.current = { vacancy_candidate_tab: JSON.stringify(STORED) }
    render(<VacancyCandidateTabSettings />)
    const shortLabels = [
      t('candidateTab.tabs.vacancy_statuses'),
      t('candidateTab.tabs.candidate_statuses'),
      t('candidateTab.tabs.contract_forms'),
      t('candidateTab.tabs.countable_statuses'),
      t('candidateTab.tabs.radius_function'),
      t('candidateTab.tabs.exclusions'),
    ]
    for (const label of shortLabels) {
      expect(screen.getByRole('tab', { name: label })).toBeInTheDocument()
    }
    // None of the long section titles leak into the tab BAR itself — they only
    // appear once the user opens the matching tab (checked below).
    expect(screen.queryByRole('tab', { name: t('candidateTab.leadsCriteria.excludeAlreadyAppliedLabel') })).toBeNull()
  })

  it('renders the original long section title inside each tab body once opened', async () => {
    blobRef.current = { vacancy_candidate_tab: JSON.stringify(STORED) }
    const user = userEvent.setup()
    render(<VacancyCandidateTabSettings />)

    // vacancy_statuses is the default tab — its long title is already visible.
    expect(screen.getByText(t('candidateTab.vacancyStatusesTitle'))).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: t('candidateTab.tabs.candidate_statuses') }))
    expect(screen.getByText(t('candidateTab.candidateStatusesTitle'))).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: t('candidateTab.tabs.contract_forms') }))
    expect(screen.getByText(t('candidateTab.contractFormsTitle'))).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: t('candidateTab.tabs.countable_statuses') }))
    expect(screen.getByText(t('candidateTab.leadsCriteria.countableStatusesTitle'))).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: t('candidateTab.tabs.radius_function') }))
    expect(screen.getByText(t('candidateTab.leadsCriteria.title'))).toBeInTheDocument()
  })

  it('keeps the tab strip inside the same 720px container as the rest of the form', () => {
    blobRef.current = { vacancy_candidate_tab: JSON.stringify(STORED) }
    render(<VacancyCandidateTabSettings />)
    const strip = screen.getByRole('tablist')
    // The short labels fit at 720px (see the measured comment above), so the
    // strip lives inside the SAME maxWidth:720 ancestor as the form fields —
    // a regression back to a separate wide wrapper would fail this.
    let el = strip.parentElement
    let found = false
    while (el && el !== document.body) {
      if (el.style.maxWidth === '720px') { found = true; break }
      el = el.parentElement
    }
    expect(found).toBe(true)
  })
})
