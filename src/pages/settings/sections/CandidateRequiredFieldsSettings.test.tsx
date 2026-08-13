/**
 * CandidateRequiredFieldsSettings — Danny 09-08: "ik mis heel veel velden zoals mobiel …
 * maakt iemand een extra veld, dan moet die hier ook komen als blokje en ook verplicht
 * kunnen worden."
 *
 * §13: every save assertion checks the REQUEST (route + body), never only that a
 * callback fired — this screen writes to TWO different places on purpose, and the whole
 * point of the custom-field block is that it must NOT land in the settings blob.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import CandidateRequiredFieldsSettings from './CandidateRequiredFieldsSettings'
import {
  CANDIDATE_FIELD_GROUPS, CANDIDATE_FIELD_KEYS, EXCLUDED_SYSTEM_FIELDS,
  normalizeRequiredFieldKeys,
} from './candidates/requiredFieldsCatalog'

// Resolve labels from the real bundle rather than guessing a Dutch string.
const ct = (key: string) => i18n.t(key.split(':')[1], { ns: 'candidates' })

// The settings blob is controlled per test; saves go through the REAL saveSettingsKeys
// so the api.post seam is asserted (mirrors CustomerRequiredFieldsSettings.test.tsx).
const blobRef = vi.hoisted(() => ({ current: {} as Record<string, unknown> }))
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual('@/lib/settings/useAllSettings')
  return { ...actual, useAllSettings: () => blobRef.current }
})

// One api mock for all three seams: GET /custom-fields, POST /settings, PATCH /custom-fields/{id}.
const defsRef = vi.hoisted(() => ({ current: [] as unknown[] }))
const postMock = vi.hoisted(() => vi.fn(() => Promise.resolve({ data: {} })))
const patchMock = vi.hoisted(() => vi.fn(() => Promise.resolve({ data: {} })))
// useCustomFields caches definitions per `${tenantId}:${entity}` in module scope, so a
// test that rendered with zero defs would poison every later one. Handing each test its
// own tenant id gives it a fresh cache key — the real cache path still runs.
const tenantRef = vi.hoisted(() => ({ current: 0 }))
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return {
    ...actual,
    default: {
      get: vi.fn(() => Promise.resolve({ data: { data: defsRef.current } })),
      post: postMock,
      patch: patchMock,
    },
    getActiveTenantId: vi.fn(() => `tenant-${tenantRef.current}`),
  }
})

// Two tenant phases — the real lookup shape, never a hardcoded pair inside the screen.
vi.mock('@/context/LookupsContext', () => ({
  useLookups: () => ({
    phases: [{ value: 'lead', label: 'Lead' }, { value: 'candidate', label: 'Kandidaat' }],
  }),
}))

afterEach(() => {
  vi.clearAllMocks()
  blobRef.current = {}
  defsRef.current = []
  tenantRef.current += 1
})

// The screen opens the blocks that already hold a required field, so a test that wants a
// built-in toggle mounted must seed one from that block first (collapsed = unmounted).
const CONTACT_OPEN = { candidate_required_fields: { lead: ['email'] } }

describe('requiredFieldsCatalog — what a tenant may mark required', () => {
  it('carries mobile, the field Danny called out as missing', () => {
    expect(CANDIDATE_FIELD_KEYS).toContain('mobile')
  })

  it('is far wider than the 18 hardcoded fields it replaced', () => {
    expect(CANDIDATE_FIELD_KEYS.length).toBeGreaterThan(18)
  })

  it('excludes every system/derived field — those can never be filled in (§3)', () => {
    const leaked = CANDIDATE_FIELD_KEYS.filter(k => EXCLUDED_SYSTEM_FIELDS.includes(k))
    expect(leaked).toEqual([])
    // Spot-check the classes: stamped, derived, response-only alias, per-application.
    for (const sys of ['created_at', 'deleted_at', 'lat', 'reference_number', 'branch_id', 'funnel_type']) {
      expect(CANDIDATE_FIELD_KEYS).not.toContain(sys)
    }
  })

  it('omits place_of_birth — measured unwritable, so requiring it would block every create', () => {
    // Measured live 2026-08-09: one PATCH /candidates/{id} carrying both `mobile` and
    // `place_of_birth` wrote the mobile and left the birthplace untouched (no rule on
    // CandidateProfileRequest). A create can never satisfy it → fake affordance (§3).
    expect(CANDIDATE_FIELD_KEYS).not.toContain('place_of_birth')
    expect(EXCLUDED_SYSTEM_FIELDS).toContain('place_of_birth')
  })

  it('uses the guard-readable WRITE keys, not the response aliases', () => {
    // Measured live: $candidate->postcode is set while ->postal_code is NULL, so a
    // stored `postal_code` can never be satisfied and would lock every save.
    expect(CANDIDATE_FIELD_KEYS).toContain('postcode')
    expect(CANDIDATE_FIELD_KEYS).not.toContain('postal_code')
    expect(CANDIDATE_FIELD_KEYS).toContain('linkedin_slug')
    expect(CANDIDATE_FIELD_KEYS).not.toContain('linkedin')
  })

  it('folds the legacy keys onto their working equivalent without dropping anything', () => {
    expect(normalizeRequiredFieldKeys(['first_name', 'postal_code', 'linkedin']))
      .toEqual(['first_name', 'postcode', 'linkedin_slug'])
    // An unknown key is kept — it may be an attribute a later release adds.
    expect(normalizeRequiredFieldKeys(['who_knows'])).toEqual(['who_knows'])
  })

  it('every field has a label key that resolves in the bundle', () => {
    for (const group of CANDIDATE_FIELD_GROUPS) {
      for (const f of group.fields) expect(ct(f.labelKey)).not.toBe(f.labelKey.split(':')[1])
    }
  })
})

describe('built-in fields — saving keeps the phase-keyed shape', () => {
  it('toggling a field POSTs { phase: [keys] } and leaves the other phase untouched', async () => {
    const user = userEvent.setup()
    blobRef.current = { candidate_required_fields: { lead: ['first_name'], candidate: ['first_name', 'email'] } }
    render(<CandidateRequiredFieldsSettings />)

    await user.click(screen.getByRole('switch', { name: `${ct('candidates:modal.fields.mobile')} — Kandidaat` }))

    expect(postMock).toHaveBeenCalledWith('/settings', {
      candidate_required_fields: JSON.stringify({
        lead: ['first_name'],
        candidate: ['first_name', 'email', 'mobile'],
      }),
    })
  })

  it('a stored required field renders its toggle as ON (round trip)', () => {
    blobRef.current = { candidate_required_fields: { candidate: ['mobile'] } }
    render(<CandidateRequiredFieldsSettings />)
    expect(screen.getByRole('switch', { name: `${ct('candidates:modal.fields.mobile')} — Kandidaat` }))
      .toHaveStyle({ background: 'var(--color-primary)' })
  })

  it('a legacy postal_code entry shows as the working postcode toggle and saves folded', async () => {
    const user = userEvent.setup()
    blobRef.current = { candidate_required_fields: { lead: ['postal_code'] } }
    render(<CandidateRequiredFieldsSettings />)

    const postcodeToggle = screen.getByRole('switch', { name: `${ct('candidates:modal.fields.postalCode')} — Lead` })
    expect(postcodeToggle).toHaveStyle({ background: 'var(--color-primary)' })

    // Toggling any other field rewrites the map onto guard-readable keys.
    await user.click(screen.getByRole('switch', { name: `${ct('candidates:modal.fields.city')} — Lead` }))
    expect(postMock).toHaveBeenCalledWith('/settings', {
      candidate_required_fields: JSON.stringify({ lead: ['postcode', 'city'] }),
    })
  })

  it('groups collapse and expand from the keyboard', async () => {
    const user = userEvent.setup()
    blobRef.current = CONTACT_OPEN
    render(<CandidateRequiredFieldsSettings />)
    const header = screen.getByRole('button', { name: new RegExp(ct('candidates:modal.fields.cardContact')) })
    expect(header).toHaveAttribute('aria-expanded', 'true')

    // Enter and Space both operate it because it is a real <button> (§6).
    header.focus()
    await user.keyboard('{Enter}')
    expect(header).toHaveAttribute('aria-expanded', 'false')
    // Collapsed means unmounted: nothing hidden left in the tab order.
    expect(screen.queryByRole('switch', { name: `${ct('candidates:modal.fields.mobile')} — Lead` })).toBeNull()

    await user.keyboard(' ')
    expect(header).toHaveAttribute('aria-expanded', 'true')
  })
})

describe('expand all / collapse all — drives every built-in group at once', () => {
  it('collapse all closes every group, expand all reopens every group', async () => {
    const user = userEvent.setup()
    blobRef.current = CONTACT_OPEN
    render(<CandidateRequiredFieldsSettings />)

    const contactHeader = screen.getByRole('button', { name: new RegExp(ct('candidates:modal.fields.cardContact')) })
    expect(contactHeader).toHaveAttribute('aria-expanded', 'true')

    await user.click(screen.getByRole('button', { name: i18n.t('requiredFields.collapseAll', { ns: 'settings' }) }))
    expect(contactHeader).toHaveAttribute('aria-expanded', 'false')

    await user.click(screen.getByRole('button', { name: i18n.t('requiredFields.expandAll', { ns: 'settings' }) }))
    expect(contactHeader).toHaveAttribute('aria-expanded', 'true')
  })
})

describe('custom fields — the toggle writes to the DEFINITION, never to the setting', () => {
  const def = {
    id: 'cf-1', entity_type: 'candidate', key: 'helloflexguid',
    label_i18n: { nl: 'HelloFlexGUID', en: 'HelloFlexGUID' }, type: 'text', options: [],
    required: false, required_phases: null, show_in_table: false, visible_in_ui: true,
    sort_order: 0, active: true, in_use: true,
  }

  it('PATCHes /custom-fields/{id} with required_phases and does NOT touch /settings', async () => {
    const user = userEvent.setup()
    defsRef.current = [def]
    render(<CandidateRequiredFieldsSettings />)

    const toggle = await screen.findByRole('switch', { name: 'HelloFlexGUID — Kandidaat' })
    await user.click(toggle)

    // The route the guard actually reads (measured live: 200 + value survives a re-read).
    await waitFor(() => expect(patchMock).toHaveBeenCalledWith('/custom-fields/cf-1', { required_phases: ['candidate'] }))
    // The dead-switch guard: a custom-field key in candidate_required_fields does nothing.
    expect(postMock).not.toHaveBeenCalled()
  })

  it('an already-required phase is removed from the definition, not added twice', async () => {
    const user = userEvent.setup()
    defsRef.current = [{ ...def, required_phases: ['lead', 'candidate'] }]
    render(<CandidateRequiredFieldsSettings />)

    await user.click(await screen.findByRole('switch', { name: 'HelloFlexGUID — Lead' }))
    await waitFor(() => expect(patchMock).toHaveBeenCalledWith('/custom-fields/cf-1', { required_phases: ['candidate'] }))
  })

  it('a globally required field shows on + disabled instead of lying about its phases', async () => {
    defsRef.current = [{ ...def, required: true }]
    render(<CandidateRequiredFieldsSettings />)

    const toggle = await screen.findByRole('switch', { name: 'HelloFlexGUID — Lead' })
    expect(toggle).toBeDisabled()
    expect(toggle).toHaveAttribute('aria-checked', 'true')
  })

  it('renders a calm empty state when the tenant has no custom fields yet', async () => {
    defsRef.current = []
    render(<CandidateRequiredFieldsSettings />)
    const block = screen.getByRole('button', { name: new RegExp(ct('candidates:drawer.customFields')) })
    expect(block).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByText(i18n.t('requiredFields.customEmpty', { ns: 'settings' }))).toBeInTheDocument())
  })

  it('surfaces a save failure instead of showing a toggle that silently did nothing', async () => {
    const user = userEvent.setup()
    defsRef.current = [def]
    patchMock.mockRejectedValueOnce(new Error('boom'))
    render(<CandidateRequiredFieldsSettings />)

    await user.click(await screen.findByRole('switch', { name: 'HelloFlexGUID — Lead' }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  })
})

describe('the two halves of the screen are wired to different stores', () => {
  it('a built-in toggle never PATCHes a definition', async () => {
    const user = userEvent.setup()
    blobRef.current = CONTACT_OPEN
    defsRef.current = [{
      id: 'cf-1', key: 'helloflexguid', label_i18n: { nl: 'HelloFlexGUID' }, type: 'text',
      required: false, required_phases: null, sort_order: 0, active: true, visible_in_ui: true,
    }]
    render(<CandidateRequiredFieldsSettings />)
    // Wait for the definition to land, so "no PATCH" is a real assertion and not a race.
    await screen.findByRole('switch', { name: 'HelloFlexGUID — Lead' })

    await user.click(screen.getByRole('switch', { name: `${ct('candidates:modal.fields.mobile')} — Lead` }))
    expect(postMock).toHaveBeenCalledTimes(1)
    expect(patchMock).not.toHaveBeenCalled()
  })
})
