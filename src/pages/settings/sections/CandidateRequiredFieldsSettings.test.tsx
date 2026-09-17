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
  CANDIDATE_FIELD_GROUPS, CANDIDATE_FIELD_KEYS, CANDIDATE_FIELD_LABEL_KEYS, EXCLUDED_SYSTEM_FIELDS,
  normalizeRequiredFieldKeys,
} from './candidates/requiredFieldsCatalog'
import type { FieldInventoryField, FieldInventoryGroup } from '../hooks/useFieldInventory'

// Resolve labels from the real bundle rather than guessing a Dutch string.
const ct = (key: string) => i18n.t(key.split(':')[1], { ns: 'candidates' })
// Same resolver, but namespace-aware (some verifier-fix labels live in `settings`, not `candidates`).
const resolveLabel = (key: string) => {
  const [ns, path] = key.split(':')
  return i18n.t(path, { ns })
}

// Verifier fix (17-09): the real backend group keys (measured against
// CandidateFieldCatalog.php) — used to build a fixture whose group titles are the ACTUAL
// contract label keys, so a raw-key rendering regression shows up in this suite instead
// of only in production. The legacy catalog's 8 ids are mapped onto their closest real
// counterpart (financial/consent -> dossier, other -> availability).
const REAL_GROUP_LABEL_KEY: Record<string, string> = {
  personal: 'settings.fieldInventory.groups.candidate.personal',
  function: 'settings.fieldInventory.groups.candidate.function',
  contact: 'settings.fieldInventory.groups.candidate.contact',
  address: 'settings.fieldInventory.groups.candidate.address',
  work: 'settings.fieldInventory.groups.candidate.work',
  financial: 'settings.fieldInventory.groups.candidate.dossier',
  consent: 'settings.fieldInventory.groups.candidate.dossier',
  other: 'settings.fieldInventory.groups.candidate.availability',
}

// FIELDS-2-FE-1: rows/groups now come from useFieldInventory, never the static catalog —
// so the screen's own tests mock that hook with a fixture built FROM the catalog (same
// groups/keys, all requirable, none permission-gated), which keeps every existing
// assertion below meaningful as a screen test rather than turning it into a hook test.
const inventoryOverride = vi.hoisted(() => ({ current: null as null | { groups: FieldInventoryGroup[]; fields: FieldInventoryField[] } }))
const inventoryStateRef = vi.hoisted(() => ({ current: { isLoading: false, isError: false } }))
vi.mock('../hooks/useFieldInventory', () => ({
  useFieldInventory: () => {
    const built = inventoryOverride.current ?? {
      groups: CANDIDATE_FIELD_GROUPS.map(g => ({ key: g.id, label_key: REAL_GROUP_LABEL_KEY[g.id] })),
      fields: CANDIDATE_FIELD_GROUPS.flatMap(g => g.fields.map(f => ({
        key: f.key, group: g.id, type: 'string', requirable: true, creatable: true, writable: true,
        internal_name: f.key, external_name: f.key, aliases: [], requires_permission: null, reason: null,
      }))),
    }
    return { ...built, isLoading: inventoryStateRef.current.isLoading, isError: inventoryStateRef.current.isError, refetch: vi.fn() }
  },
}))

// The settings blob is controlled per test; saves go through the REAL saveSettingsKeys
// so the api.post seam is asserted (mirrors CustomerRequiredFieldsSettings.test.tsx).
const blobRef = vi.hoisted(() => ({ current: {} as Record<string, unknown> }))
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual('@/lib/settings/useAllSettings')
  // Settings count as loaded here — the pending-state race has its own dedicated
  // tests (FlatRequiredFieldsToggleList.test.tsx / ApplicationRequiredFieldsSettings.test.tsx).
  return { ...actual, useAllSettings: () => blobRef.current, useSettingsLoaded: () => true }
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
const notifyError = vi.hoisted(() => vi.fn())
vi.mock('@/lib/notify', () => ({ notifyError, notifySuccess: vi.fn(), notify: vi.fn() }))

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
  inventoryOverride.current = null
  inventoryStateRef.current = { isLoading: false, isError: false }
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

  it('offers place_of_birth again (writable since 03-09) and the twelve fields the 09-09 review found missing', () => {
    for (const key of ['place_of_birth', 'address_line_2', 'source_detail', 'iban', 'account_holder_name', 'preferred_language',
      'whatsapp_consent', 'email_consent', 'newsletter_consent', 'retention_consent']) {
      expect(CANDIDATE_FIELD_KEYS).toContain(key)
    }
    // Still excluded: no backend rule (initials) or no input at all (facebook_leads_id).
    expect(CANDIDATE_FIELD_KEYS).not.toContain('initials')
    expect(CANDIDATE_FIELD_KEYS).not.toContain('facebook_leads_id')
  })

  it('puts the function in its own block, never under "Werk" (Danny 09-09)', () => {
    const fn = CANDIDATE_FIELD_GROUPS.find(g => g.fields.some(f => f.key === 'function_title'))
    expect(fn?.id).toBe('function')
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
    // The summary → description rename (V2-B-SUMMARY-FOLD, 2026-09-07) also folds,
    // so a tenant that stored 'summary' before the rename still renders as required.
    expect(normalizeRequiredFieldKeys(['first_name', 'summary']))
      .toEqual(['first_name', 'description'])
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
    // Asserting the shared Toggle's actual rendered token value (Toggle.tsx), not authoring UI.
    expect(screen.getByRole('switch', { name: `${ct('candidates:modal.fields.mobile')} — Kandidaat` }))
      // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- test assertion on the real component style, not new UI
      .toHaveStyle({ background: 'var(--color-primary)' })
  })

  it('a legacy postal_code entry shows as the working postcode toggle and saves folded', async () => {
    const user = userEvent.setup()
    blobRef.current = { candidate_required_fields: { lead: ['postal_code'] } }
    render(<CandidateRequiredFieldsSettings />)

    const postcodeToggle = screen.getByRole('switch', { name: `${ct('candidates:modal.fields.postalCode')} — Lead` })
    // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- test assertion on the real component style, not new UI
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

describe('expand all / collapse all — one toggle button reflects real state', () => {
  it('a mixed state resolves to expand; the same button flips to collapse once everything opens', async () => {
    const user = userEvent.setup()
    blobRef.current = CONTACT_OPEN
    render(<CandidateRequiredFieldsSettings />)

    const contactHeader = screen.getByRole('button', { name: new RegExp(ct('candidates:modal.fields.cardContact')) })
    const personalHeader = screen.getByRole('button', { name: new RegExp(ct('candidates:modal.fields.cardPersonal')) })
    // Mixed on mount: only the contact group (which holds the seeded required field) is open.
    expect(contactHeader).toHaveAttribute('aria-expanded', 'true')
    expect(personalHeader).toHaveAttribute('aria-expanded', 'false')

    // Mixed state resolves to the expand action — never collapse — and there is only
    // ONE button (no separate collapse-all sitting next to it).
    expect(screen.queryByRole('button', { name: i18n.t('requiredFields.collapseAll', { ns: 'settings' }) })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: i18n.t('requiredFields.expandAll', { ns: 'settings' }) }))

    // Expand-all opens every group, including ones with nothing required.
    expect(contactHeader).toHaveAttribute('aria-expanded', 'true')
    expect(personalHeader).toHaveAttribute('aria-expanded', 'true')

    // All open now — the SAME button swapped its label to the collapse action.
    expect(screen.queryByRole('button', { name: i18n.t('requiredFields.expandAll', { ns: 'settings' }) })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: i18n.t('requiredFields.collapseAll', { ns: 'settings' }) }))

    // Collapse-all closes every group.
    expect(contactHeader).toHaveAttribute('aria-expanded', 'false')
    expect(personalHeader).toHaveAttribute('aria-expanded', 'false')
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

// audit r2-ui-states-3: a rejected save must surface a notice — it used to be swallowed.
describe('a failed save tells the admin', () => {
  it('calls notifyError when the settings POST rejects', async () => {
    const user = userEvent.setup()
    // Seed a stored value so the phase block is expanded (collapsed = unmounted toggles).
    blobRef.current = { candidate_required_fields: { lead: ['first_name'], candidate: ['first_name', 'email'] } }
    postMock.mockRejectedValueOnce(new Error('boom'))
    render(<CandidateRequiredFieldsSettings />)
    await user.click(screen.getByRole('switch', { name: `${ct('candidates:modal.fields.mobile')} — Kandidaat` }))
    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(expect.any(String)))
  })
})

// FIELDS-2-FE-1: the three inventory-driven cases the lane brief calls for.
describe('field inventory — requirable / non-requirable / permission-gated rows', () => {
  it('a requirable row still toggles and saves with the right body (round-trip on the new source)', async () => {
    const user = userEvent.setup()
    // Seeding 'mobile' as required opens the contact block by default (see the
    // openIds effect); toggling its sibling 'email' proves the whole rewire round-trips.
    blobRef.current = { candidate_required_fields: { candidate: ['mobile'] } }
    render(<CandidateRequiredFieldsSettings />)
    await user.click(screen.getByRole('switch', { name: `${ct('candidates:modal.fields.email')} — Kandidaat` }))
    expect(postMock).toHaveBeenCalledWith('/settings', {
      candidate_required_fields: JSON.stringify({ candidate: ['mobile', 'email'] }),
    })
  })

  it('a requirable:false field renders disabled with its reason, never as a live toggle', async () => {
    inventoryOverride.current = {
      groups: [{ key: 'personal', label_key: 'candidates:modal.fields.cardPersonal' }],
      fields: [
        { key: 'first_name', group: 'personal', type: 'string', requirable: true, creatable: true, writable: true,
          internal_name: 'first_name', external_name: 'first_name', aliases: [], requires_permission: null, reason: null },
        { key: 'iban', group: 'personal', type: 'string', requirable: false, creatable: false, writable: true,
          internal_name: 'iban', external_name: null, aliases: [], requires_permission: null, reason: 'relation — slice 2' },
      ],
    }
    render(<CandidateRequiredFieldsSettings />)
    // Verifier fix (17-09): a locked field now renders THROUGH the shared matrix table
    // (same as the customer screen), so it IS a switch element — just a disabled one,
    // never a bespoke plain-text row. Its reason shows as a translated hover title.
    const ibanToggle = screen.getByRole('switch', { name: `${ct('candidates:preferences.iban')} — Lead` })
    expect(ibanToggle).toBeDisabled()
    const relationReason = i18n.t('settings.fieldInventory.reason.relation', { ns: 'settings' })
    expect(screen.getByTitle(relationReason)).toBeInTheDocument()
    // Toggling the requirable sibling still POSTs — the locked field never enters the payload.
    const user = userEvent.setup()
    await user.click(screen.getByRole('switch', { name: `${ct('candidates:modal.fields.firstName')} — Kandidaat` }))
    expect(postMock).toHaveBeenCalledWith('/settings', { candidate_required_fields: JSON.stringify({ candidate: ['first_name'] }) })
  })

  it('a requires_permission row is absent for a caller without that permission', () => {
    inventoryOverride.current = {
      groups: [{ key: 'personal', label_key: 'candidates:modal.fields.cardPersonal' }],
      fields: [
        { key: 'iban', group: 'personal', type: 'string', requirable: false, creatable: false, writable: true,
          internal_name: 'iban', external_name: null, aliases: [], requires_permission: 'candidates.financial.view', reason: 'relation — slice 2' },
      ],
    }
    render(<CandidateRequiredFieldsSettings />)
    // hasPermission is not mocked here (no AuthContext provider) so it resolves to false —
    // the row, and the now-empty group around it, must not render at all.
    expect(screen.queryByRole('switch', { name: new RegExp(ct('candidates:preferences.iban')) })).toBeNull()
    expect(screen.getByText(i18n.t('requiredFields.inventoryEmpty', { ns: 'settings' }))).toBeInTheDocument()
  })
})

// Verifier fix (17-09): stored non-requirable keys must not ride along invisibly once
// the admin can no longer see or clear them via a toggle (§3 no fake affordance).
describe('non-requirable keys never ride along in the saved payload', () => {
  it('a save strips a legacy-stored non-requirable key from every phase', async () => {
    const user = userEvent.setup()
    inventoryOverride.current = {
      groups: [{ key: 'personal', label_key: 'candidates:modal.fields.cardPersonal' }],
      fields: [
        { key: 'first_name', group: 'personal', type: 'string', requirable: true, creatable: true, writable: true,
          internal_name: 'first_name', external_name: 'first_name', aliases: [], requires_permission: null, reason: null },
        { key: 'iban', group: 'personal', type: 'string', requirable: false, creatable: false, writable: true,
          internal_name: 'iban', external_name: null, aliases: [], requires_permission: null, reason: 'relation — slice 2' },
      ],
    }
    // A tenant blob that still carries 'iban' from before it became non-requirable.
    blobRef.current = { candidate_required_fields: { lead: ['first_name', 'iban'], candidate: ['iban'] } }
    render(<CandidateRequiredFieldsSettings />)

    await user.click(screen.getByRole('switch', { name: `${ct('candidates:modal.fields.firstName')} — Kandidaat` }))
    expect(postMock).toHaveBeenCalledWith('/settings', {
      candidate_required_fields: JSON.stringify({ lead: ['first_name'], candidate: ['first_name'] }),
    })
  })
})

// Verifier fix (17-09): the label map's newly-added gap keys resolve to real translated
// text instead of falling back to their raw snake_case key.
describe('the label-map gap keys the verifier found resolve to real translations', () => {
  it('every added label key resolves in the bundle', () => {
    for (const key of ['initials', 'candidate_types', 'freelance', 'facebook_leads_id', 'location_ids', 'cv_parse_token', 'custom_fields', 'preferences']) {
      const labelKey = CANDIDATE_FIELD_LABEL_KEYS[key]
      expect(labelKey).toBeDefined()
      expect(resolveLabel(labelKey)).not.toBe(labelKey.split(':')[1])
    }
  })
})
