/**
 * useHelloflexActivitySettings (HF-ACTIVITY-ROWS-CARD-FE-1; Danny 27-11: the three HelloFlex activity settings live on the
 * connector card, never on Action rules) - the state and save path behind HelloflexActivityCard: the default owner GUID
 * (helloflex_default_owner_guid), the activity type map {HelloFlex activity type id => Koios note type slug}
 * (helloflex_activity_type_map) and the five activity default ids (helloflex_activity_defaults), read once from the shared
 * /settings blob (useAllSettings) and written through saveSettingsKeys (POST /settings, the one settings write seam).
 * Blank means "no row": a blank owner, an empty map and an empty defaults object travel as '' (the BE removes the row, 200);
 * only the keys whose wire value changed ride the POST, so a 422 can only name a key the user edited (BE batch Q
 * HelloFlexActivityRules: six codes in the envelope {message, code, errors: {<key>: [sentence]}}).
 */
import { useEffect, useRef, useState } from 'react'
import { useAllSettings, useSettingsLoadState, saveSettingsKeys } from '@/lib/settings/useAllSettings'
import { apiErrorMessage } from '@/lib/extractApiError'
import { notifyError } from '@/lib/notify'
import { isUuid } from '@/lib/uuid'

// The three catalogue keys (BE CatalogRows: screen helloflex, this card as the declared reader).
export const OWNER_KEY = 'helloflex_default_owner_guid'
export const TYPE_MAP_KEY = 'helloflex_activity_type_map'
export const DEFAULTS_KEY = 'helloflex_activity_defaults'
export type ActivityKey = typeof OWNER_KEY | typeof TYPE_MAP_KEY | typeof DEFAULTS_KEY
const ACTIVITY_KEYS: readonly ActivityKey[] = [OWNER_KEY, TYPE_MAP_KEY, DEFAULTS_KEY]

// The five HelloFlex domain ids of a placement activity (BE HelloFlexActivitySettings::DEFAULT_KEYS, same order).
export const DEFAULT_FIELDS = ['typeId', 'priorityId', 'entityStateId', 'subjectId', 'entityTypeId'] as const
export type DefaultField = (typeof DEFAULT_FIELDS)[number]

// One editable type-map row; `id` is a client-only handle so a row keeps its identity while its key is being typed.
export type TypeMapRow = { id: number; typeId: string; noteType: string }
export type ActivityDraft = { owner: string; rows: TypeMapRow[]; defaults: Record<DefaultField, string> }
type Wire = Record<ActivityKey, string>
// The translate function the save path needs for its refusal sentences (the settings-namespace t, as apiErrorMessage takes it).
type ErrorT = Parameters<typeof apiErrorMessage>[1]

// A stored JSON object (string or already decoded), tolerant: anything else reads as an empty object.
function parseObject(raw: unknown): Record<string, unknown> {
  let value: unknown = raw
  if (typeof raw === 'string') {
    if (!raw.trim()) return {}
    try { value = JSON.parse(raw) } catch { return {} }
  }
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

// A stored id as its digit string: non-negative ints and digit strings pass, anything else reads as blank.
function digitsOf(v: unknown): string {
  if (typeof v === 'number' && Number.isInteger(v) && v >= 0) return String(v)
  return typeof v === 'string' && /^\d+$/.test(v) ? v : ''
}

// The editable draft of the three settings as the blob stores them; a stored map value that is not a string reads as a row
// without a note type, which the half-filled notice then surfaces (and blocks the save until the row is fixed or removed).
export function draftFromBlob(blob: Record<string, unknown>): ActivityDraft {
  const owner = blob[OWNER_KEY]
  const rows = Object.entries(parseObject(blob[TYPE_MAP_KEY]))
    .map(([typeId, slug], i) => ({ id: i + 1, typeId, noteType: typeof slug === 'string' ? slug : '' }))
  const stored = parseObject(blob[DEFAULTS_KEY])
  const defaults = Object.fromEntries(DEFAULT_FIELDS.map(f => [f, digitsOf(stored[f])])) as Record<DefaultField, string>
  return { owner: typeof owner === 'string' ? owner : '', rows, defaults }
}

// The wire form per key: '' for "no row", else the trimmed GUID or the JSON object (ids as integers, blank members dropped).
export function wireOf(draft: ActivityDraft): Wire {
  const map: Record<string, string> = {}
  draft.rows.forEach(r => { if (r.typeId) map[r.typeId] = r.noteType })
  const defaults: Record<string, number> = {}
  DEFAULT_FIELDS.forEach(f => { if (draft.defaults[f]) defaults[f] = Number(draft.defaults[f]) })
  return {
    [OWNER_KEY]: draft.owner.trim(),
    [TYPE_MAP_KEY]: Object.keys(map).length ? JSON.stringify(map) : '',
    [DEFAULTS_KEY]: Object.keys(defaults).length ? JSON.stringify(defaults) : '',
  }
}

// The card's state: draft, dirty/notices, the save with its per-key refusal, and the load state with retry.
export function useHelloflexActivitySettings(t: ErrorT) {
  const blob = useAllSettings()
  const { state: loadState, retry } = useSettingsLoadState()
  const [draft, setDraft] = useState<ActivityDraft | null>(null)
  const [initialWire, setInitialWire] = useState<Wire | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  // The refused key of the last save with its translated sentence, shown under that key's own block; cleared on edit.
  const [fieldError, setFieldError] = useState<{ key: ActivityKey; message: string } | null>(null)
  const nextRowId = useRef(0)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Seed the draft ONCE when the shared blob has loaded; a later blob change (another subscriber saving) never wipes typing.
  useEffect(() => {
    if (loadState !== 'loaded' || draft !== null) return
    const seeded = draftFromBlob(blob)
    nextRowId.current = seeded.rows.length
    setDraft(seeded)
    setInitialWire(wireOf(seeded))
  }, [loadState, blob, draft])

  // The saved flash never fires on an unmounted card.
  useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current) }, [])

  const wire = draft ? wireOf(draft) : null
  const dirty = !!wire && !!initialWire && ACTIVITY_KEYS.some(k => wire[k] !== initialWire[k])
  // Client-side notices (the BE re-validates): a non-GUID owner, a type id mapped twice, a half-filled row.
  const ownerInvalid = !!draft && draft.owner.trim() !== '' && !isUuid(draft.owner.trim())
  const typedIds = draft ? draft.rows.map(r => r.typeId).filter(Boolean) : []
  const typeMapDuplicate = new Set(typedIds).size !== typedIds.length
  const typeMapIncomplete = !!draft && draft.rows.some(r => (r.typeId === '') !== (r.noteType === ''))
  const canSave = dirty && !ownerInvalid && !typeMapDuplicate && !typeMapIncomplete

  // Every edit goes through here, so the previous refusal clears as soon as the user changes anything.
  const edit = (patch: (d: ActivityDraft) => ActivityDraft) => {
    setFieldError(null)
    setDraft(d => (d ? patch(d) : d))
  }
  const setOwner = (owner: string) => edit(d => ({ ...d, owner }))
  const setDefault = (field: DefaultField, value: string) =>
    edit(d => ({ ...d, defaults: { ...d.defaults, [field]: value.replace(/\D/g, '') } }))
  const setRow = (id: number, patch: Partial<Omit<TypeMapRow, 'id'>>) =>
    edit(d => ({ ...d, rows: d.rows.map(r => (r.id === id ? { ...r, ...patch, typeId: (patch.typeId ?? r.typeId).replace(/\D/g, '') } : r)) }))
  const addRow = () => {
    nextRowId.current += 1
    const id = nextRowId.current
    edit(d => ({ ...d, rows: [...d.rows, { id, typeId: '', noteType: '' }] }))
  }
  const removeRow = (id: number) => edit(d => ({ ...d, rows: d.rows.filter(r => r.id !== id) }))

  // POST only the changed keys; a refusal names its key in `errors`, which lands under that block (any other key: a toast).
  const save = async () => {
    if (!wire || !initialWire || !canSave) return
    const partial: Partial<Wire> = {}
    ACTIVITY_KEYS.forEach(k => { if (wire[k] !== initialWire[k]) partial[k] = wire[k] })
    setSaving(true)
    try {
      await saveSettingsKeys(partial)
      setInitialWire(wire)
      setSaved(true)
      if (savedTimer.current) clearTimeout(savedTimer.current)
      savedTimer.current = setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      const errors = (err as { response?: { data?: { errors?: Record<string, unknown> } } })?.response?.data?.errors
      const refused = errors ? Object.keys(errors)[0] : undefined
      const message = apiErrorMessage(err, t, t('integrations.helloflexActivity.saveError'))
      if (refused && (ACTIVITY_KEYS as readonly string[]).includes(refused)) setFieldError({ key: refused as ActivityKey, message })
      else notifyError(message)
    } finally {
      setSaving(false)
    }
  }

  return { loadState, retry, draft, dirty, saving, saved, canSave, ownerInvalid, typeMapDuplicate, typeMapIncomplete, fieldError, setOwner, setDefault, setRow, addRow, removeRow, save }
}
