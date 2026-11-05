/** CandidateRequiredFieldsSettings · save failure, field inventory and payload hygiene (split from CandidateRequiredFieldsSettings.test.tsx; mocks duplicated because hoisted vi.mock blocks cannot be shared). */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import CandidateRequiredFieldsSettings from './CandidateRequiredFieldsSettings'
import {
  CANDIDATE_FIELD_GROUPS, CANDIDATE_FIELD_LABEL_KEYS,
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
