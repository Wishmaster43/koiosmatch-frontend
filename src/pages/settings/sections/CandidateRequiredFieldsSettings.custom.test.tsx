/** CandidateRequiredFieldsSettings · custom-field definitions and store wiring (split from CandidateRequiredFieldsSettings.test.tsx; mocks duplicated because hoisted vi.mock blocks cannot be shared). */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import CandidateRequiredFieldsSettings from './CandidateRequiredFieldsSettings'
import {
  CANDIDATE_FIELD_GROUPS,
} from './candidates/requiredFieldsCatalog'
import type { FieldInventoryField, FieldInventoryGroup } from '../hooks/useFieldInventory'

// Resolve labels from the real bundle rather than guessing a Dutch string.
const ct = (key: string) => i18n.t(key.split(':')[1], { ns: 'candidates' })

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
