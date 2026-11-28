/**
 * HelloflexActivityCard (HF-ACTIVITY-ROWS-CARD-FE-1) - the three HelloFlex activity settings on the connector card: the draft
 * seeds from the shared /settings blob, the save POSTs only the changed keys in the BE wire form (REQUEST-ASSERT on
 * POST /settings), a coded 422 lands as the translated sentence under the refused key's block (never the server text), the
 * client notices gate the save, and the note-type picker clears back to its placeholder (DROPDOWN-CLEAR-1 regression).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import HelloflexActivityCard from './HelloflexActivityCard'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notify: vi.fn(), notifyError: vi.fn() }))
// The shared blob and its load state are driven per test; saveSettingsKeys stays REAL so the POST body is asserted at the seam.
const settingsState = vi.hoisted(() => ({ blob: {} as Record<string, unknown>, state: 'loaded' as 'loading' | 'loaded' | 'failed', retry: vi.fn() }))
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual<typeof import('@/lib/settings/useAllSettings')>('@/lib/settings/useAllSettings')
  return { ...actual, useAllSettings: () => settingsState.blob, useSettingsLoadState: () => ({ state: settingsState.state, retry: settingsState.retry }) }
})
// Two writable candidate note types; labelOf resolves a stored slug to its label.
const noteTypes = vi.hoisted(() => [{ value: 'general', label: 'Algemeen' }, { value: 'intake', label: 'Intake' }])
vi.mock('@/lib/useNoteTypes', () => ({
  useNoteTypes: () => ({ writableTypes: noteTypes, labelOf: (v?: string | null) => noteTypes.find(n => n.value === v)?.label ?? v ?? '' }),
}))

import { notifyError } from '@/lib/notify'

const t = (key: string) => i18n.t(key, { ns: 'settings' })
const tc = (key: string) => i18n.t(key, { ns: 'common' })
const K = 'integrations.helloflexActivity'
const GUID = '3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b'
const byId = (id: string) => document.getElementById(id) as HTMLInputElement
const saveButton = () => screen.getByRole('button', { name: t(`${K}.save`) })
// Row-numbered accessible names: the picker's name is "<note type, row n>: <value>", the remove button "Remove row n".
const rowName = (key: string, n: number) => i18n.t(`${K}.${key}`, { ns: 'settings', n }) as string
const pickerTrigger = (n = 1) => screen.getByRole('button', { name: (name: string) => name.startsWith(`${rowName('noteTypeRow', n)}: `) })
const removeButton = (n = 1) => screen.getByRole('button', { name: rowName('removeRowN', n) })

beforeEach(() => {
  vi.clearAllMocks()
  settingsState.blob = {}
  settingsState.state = 'loaded'
  vi.mocked(api.post).mockResolvedValue({ data: {} })
})

describe('HelloflexActivityCard · seed and load states', () => {
  it('seeds the owner, the type map rows and the defaults from the blob (JSON string and decoded object alike)', async () => {
    settingsState.blob = { helloflex_default_owner_guid: GUID, helloflex_activity_type_map: '{"530":"intake"}', helloflex_activity_defaults: { typeId: 918, priorityId: '7' } }
    render(<HelloflexActivityCard />)
    expect(await screen.findByDisplayValue(GUID)).toBeInTheDocument()
    expect(byId('hf-activity-type-id-1').value).toBe('530')
    expect(pickerTrigger()).toHaveTextContent('Intake')
    expect(byId('hf-activity-default-typeId').value).toBe('918')
    expect(byId('hf-activity-default-priorityId').value).toBe('7')
    expect(byId('hf-activity-default-entityStateId').value).toBe('')
    expect(pickerTrigger()).toHaveAccessibleName(`${rowName('noteTypeRow', 1)}: Intake`)
    expect(saveButton()).toBeDisabled()
  })

  it('a failed /settings load shows its own error state, and retry re-issues the load', async () => {
    settingsState.state = 'failed'
    render(<HelloflexActivityCard />)
    expect(screen.getByText(t(`${K}.loadError`))).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: tc('error.retry') }))
    expect(settingsState.retry).toHaveBeenCalledTimes(1)
  })
})

describe('HelloflexActivityCard · save request (POST /settings)', () => {
  it('POSTs only the changed keys in the wire form: a new row as {id: slug}, the defaults as integers, the untouched owner absent', async () => {
    settingsState.blob = { helloflex_default_owner_guid: GUID }
    const user = userEvent.setup()
    render(<HelloflexActivityCard />)
    await screen.findByDisplayValue(GUID)
    await user.click(screen.getByRole('button', { name: t(`${K}.addRow`) }))
    await user.type(byId('hf-activity-type-id-1'), '53x0')
    await user.click(pickerTrigger())
    await user.click(screen.getByRole('button', { name: 'Intake' }))
    await user.type(byId('hf-activity-default-typeId'), '918')
    await user.click(saveButton())
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/settings', {
      helloflex_activity_type_map: '{"530":"intake"}',
      helloflex_activity_defaults: '{"typeId":918}',
    }))
    expect(api.post).toHaveBeenCalledTimes(1)
  })

  it('clearing the stored owner sends "" for that key only (the BE removes the row)', async () => {
    settingsState.blob = { helloflex_default_owner_guid: GUID, helloflex_activity_type_map: '{"530":"intake"}' }
    const user = userEvent.setup()
    render(<HelloflexActivityCard />)
    await user.clear(await screen.findByDisplayValue(GUID))
    await user.click(saveButton())
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/settings', { helloflex_default_owner_guid: '' }))
  })

  it('removing the last row saves the type map as "" (row removed) and shows the empty state', async () => {
    settingsState.blob = { helloflex_activity_type_map: '{"530":"intake"}' }
    const user = userEvent.setup()
    render(<HelloflexActivityCard />)
    await screen.findByDisplayValue('530')
    await user.click(removeButton(1))
    expect(screen.getByText(t(`${K}.typeMapEmpty`))).toBeInTheDocument()
    await user.click(saveButton())
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/settings', { helloflex_activity_type_map: '' }))
  })
})

describe('HelloflexActivityCard · refusals and client notices', () => {
  it('a coded 422 on the owner lands as the translated sentence under the owner field, never the server text, and marks the input', async () => {
    vi.mocked(api.post).mockRejectedValue({ response: { status: 422, data: { message: 'NL zin', code: 'setting_guid_invalid', errors: { helloflex_default_owner_guid: ['NL zin'] } } } })
    const user = userEvent.setup()
    render(<HelloflexActivityCard />)
    await user.type(await screen.findByLabelText(t(`${K}.ownerGuid`)), GUID)
    await user.click(saveButton())
    expect(await screen.findByText(tc('errors.settingGuidInvalid'))).toBeInTheDocument()
    expect(screen.queryByText('NL zin')).not.toBeInTheDocument()
    expect(byId('hf-activity-owner')).toHaveAttribute('aria-invalid', 'true')
    expect(byId('hf-activity-owner')).toHaveAttribute('aria-describedby', 'hf-activity-owner-notice')
    expect(notifyError).not.toHaveBeenCalled()
    // The next edit clears the refusal.
    await user.type(byId('hf-activity-owner'), 'x')
    expect(screen.queryByText(tc('errors.settingGuidInvalid'))).not.toBeInTheDocument()
  })

  it('a coded 422 on the defaults lands under the defaults block, pointed at by every default input', async () => {
    vi.mocked(api.post).mockRejectedValue({ response: { status: 422, data: { message: 'NL zin', code: 'setting_defaults_value_not_digits', errors: { helloflex_activity_defaults: ['NL zin'] } } } })
    const user = userEvent.setup()
    render(<HelloflexActivityCard />)
    await user.type(await screen.findByLabelText(t(`${K}.typeId`)), '5')
    await user.click(saveButton())
    expect(await screen.findByText(tc('errors.settingDefaultsValueNotDigits'))).toBeInTheDocument()
    for (const field of ['typeId', 'priorityId', 'entityStateId', 'subjectId', 'entityTypeId']) {
      expect(byId(`hf-activity-default-${field}`)).toHaveAttribute('aria-describedby', 'hf-activity-defaults-notice')
      expect(byId(`hf-activity-default-${field}`)).toHaveAttribute('aria-invalid', 'true')
    }
  })

  it('a coded 422 naming a key outside the card toasts the translated sentence instead', async () => {
    vi.mocked(api.post).mockRejectedValue({ response: { status: 422, data: { message: 'NL zin', code: 'setting_json_object_required', errors: { other_key: ['NL zin'] } } } })
    const user = userEvent.setup()
    render(<HelloflexActivityCard />)
    await user.type(await screen.findByLabelText(t(`${K}.typeId`)), '5')
    await user.click(saveButton())
    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(tc('errors.settingJsonObjectRequired')))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('a non-GUID owner shows the client notice and keeps Save disabled', async () => {
    const user = userEvent.setup()
    render(<HelloflexActivityCard />)
    await user.type(await screen.findByLabelText(t(`${K}.ownerGuid`)), 'abc')
    expect(screen.getByText(t(`${K}.ownerGuidInvalid`))).toBeInTheDocument()
    expect(saveButton()).toBeDisabled()
    expect(api.post).not.toHaveBeenCalled()
  })

  it('a type id mapped twice, or a half-filled row, shows its notice, points every row input at it and keeps Save disabled', async () => {
    settingsState.blob = { helloflex_activity_type_map: '{"530":"intake"}' }
    const user = userEvent.setup()
    render(<HelloflexActivityCard />)
    await user.click(await screen.findByRole('button', { name: t(`${K}.addRow`) }))
    // An id without a note type: half-filled.
    await user.type(byId('hf-activity-type-id-2'), '7')
    expect(screen.getByText(t(`${K}.typeMapIncomplete`))).toBeInTheDocument()
    expect(saveButton()).toBeDisabled()
    for (const n of [1, 2]) {
      expect(byId(`hf-activity-type-id-${n}`)).toHaveAttribute('aria-describedby', 'hf-activity-type-map-notice')
      expect(byId(`hf-activity-type-id-${n}`)).toHaveAttribute('aria-invalid', 'true')
    }
    await user.click(pickerTrigger(2))
    await user.click(screen.getByRole('button', { name: 'Algemeen' }))
    expect(screen.queryByText(t(`${K}.typeMapIncomplete`))).not.toBeInTheDocument()
    expect(byId('hf-activity-type-id-1')).not.toHaveAttribute('aria-describedby')
    expect(saveButton()).toBeEnabled()
    // The same id as row 1: mapped twice (the duplicate notice outranks the half-filled one).
    await user.clear(byId('hf-activity-type-id-2'))
    await user.type(byId('hf-activity-type-id-2'), '530')
    expect(screen.getByText(t(`${K}.typeMapDuplicate`))).toBeInTheDocument()
    expect(saveButton()).toBeDisabled()
  })
})

describe('HelloflexActivityCard · note-type picker (DROPDOWN-CLEAR-1)', () => {
  it('picks, clears through the shared X back to the placeholder, and picks again', async () => {
    settingsState.blob = { helloflex_activity_type_map: '{"530":"intake"}' }
    const user = userEvent.setup()
    render(<HelloflexActivityCard />)
    await waitFor(() => expect(pickerTrigger()).toHaveTextContent('Intake'))
    await user.click(screen.getByRole('button', { name: tc('clear') }))
    expect(pickerTrigger()).toHaveTextContent(t(`${K}.noteTypePlaceholder`))
    expect(screen.getByText(t(`${K}.typeMapIncomplete`))).toBeInTheDocument()
    await user.click(pickerTrigger())
    await user.click(screen.getByRole('button', { name: 'Algemeen' }))
    expect(pickerTrigger()).toHaveTextContent('Algemeen')
    expect(screen.queryByText(t(`${K}.typeMapIncomplete`))).not.toBeInTheDocument()
  })
})
