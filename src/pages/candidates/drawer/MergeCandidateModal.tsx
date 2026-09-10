/**
 * MergeCandidateModal — absorb a duplicate candidate into a survivor (Danny punt 4:
 * the backend merge existed, the UI never did). Step 1: pick the duplicate
 * (name/number/email so lookalikes are tellable apart). Step 2: choose which of
 * the two records REMAINS; the other is absorbed and archived (soft-delete,
 * server-side C-29). Calls POST /candidates/{survivor}/merge (verified live
 * 09-08, permission candidates.delete) and hands the survivor id back to the
 * page, which reopens it fresh.
 *
 * X-37 (Danny K-27, "no auto-merge on conflicting custom-field values — the user
 * chooses per field"): confirming step 2 first loads both records' custom_fields
 * (the LITE picker rows carry none). No collision → the merge fires straight away,
 * the source's values filling the survivor's empty fields. A collision → step 3
 * (MergeFieldConflicts) with a per-field two-way choice, preselected on the survivor.
 * The resulting map travels INSIDE the merge call as `field_choices.custom_fields`
 * (CandidateMerger applies field_choices in the merge transaction, fillable keys
 * only) — one atomic write, never a separate PATCH that could land without the merge.
 * When nothing would change, the request stays the plain `{ source_id }`.
 *
 * MERGE-PICKER-1 (Danny 08-08 punt 20, "kandidaat samenvoegen: zoekbare dropdown
 * hebben die leesbaar is"): step 1 used to be a hand-rolled search input plus an
 * inline result list — the only picker in the app that was not the house dropdown.
 * It is now the shared `SearchSelect` in server-search mode (`onSearch` debounces
 * the term up to this component, which re-fetches a capped 8 rows — never the whole
 * table, §8) with `closeOnToggle` so one pick closes it: a real searchable dropdown,
 * strict (no create — a candidate is a relational id, not free text).
 * HUISSTIJL-1: step 2's survivor picker is the shared `SegmentedControl` (radiogroup +
 * roving tabindex) instead of a hand-rolled `aria-pressed` card pair — it also folds in
 * the READABILITY fix this file used to hand-roll: SegmentedControl already renders its
 * active-option text via `--color-primary-text` (never the raw `--color-primary`), which
 * useTenantTheme keeps ≥4.5:1 on the surface for any tenant brand.
 */
import { useCallback, useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronDown, GitMerge } from 'lucide-react'
import api, { unwrap, unwrapList } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import FloatingPanel from '@/components/ui/FloatingPanel'
import SearchSelect from '@/components/ui/SearchSelect'
import SegmentedControl from '@/components/ui/SegmentedControl'
import { Caption } from '@/components/ui/typography'
import { Z } from '@/lib/zIndexScale'
import { fieldInputStyle } from '@/components/forms/fieldMetrics'
import type { Id } from '@/types/common'
import MergeModalFooter from '@/components/forms/MergeModalFooter'
import { useCustomFields } from '@/lib/useCustomFields'
import MergeFieldConflicts from './MergeFieldConflicts'
import { computeCustomFieldConflicts, customFieldsChanged, mergeCustomFieldMaps } from './mergeCustomFields'
import type { ConflictChoice, CustomFieldMap } from './mergeCustomFields'

// Modal body is 460 wide with 20px padding — the dropdown spans that inner width so
// a full "name · number · e-mail" row is readable without truncating (punt 20).
const PICKER_WIDTH = 420
// Shortest term worth a round trip; below it the picker says so instead of
// silently showing "no results".
const MIN_SEARCH_LENGTH = 2

interface LiteCandidate { id: Id; name: string; code?: string; email?: string }

// Minimal list-row shape from GET /candidates (only the fields this picker shows).
interface ApiRow { id: Id; first_name?: string; last_name?: string; name?: string; reference_number?: string; email?: string }
const rowToLite = (r: ApiRow): LiteCandidate => ({
  id: r.id,
  name: r.name ?? [r.first_name, r.last_name].filter(Boolean).join(' '),
  code: r.reference_number ?? undefined,
  email: r.email ?? undefined,
})

// Both records' custom_fields maps, loaded on step-2 confirm (survivor side first).
interface CustomMaps { survivor: CustomFieldMap; source: CustomFieldMap }
// The detail payload's custom_fields map, tolerant of a missing key (older rows).
const customMapOf = (res: unknown): CustomFieldMap =>
  (unwrap<{ custom_fields?: CustomFieldMap } | null>(res as { data: unknown })?.custom_fields) ?? {}

// Two-step merge flow with a conditional third step (see the module doc above): a
// searchable duplicate picker, a survivor choice, then — only on colliding custom
// fields — a per-field choice; the merge endpoint gets the survivor id + field_choices.
export default function MergeCandidateModal({ current, onClose, onMerged, initialOther }: {
  current: LiteCandidate
  onClose: () => void
  onMerged: (survivorId: Id) => void
  // Bulk-merge entry (punt 4): prefills the duplicate so the modal opens straight
  // into step 2 (survivor choice) instead of making the recruiter re-search someone
  // they already picked via the two-row table selection.
  initialOther?: LiteCandidate
}) {
  const { t } = useTranslation('candidates')
  const queryClient = useQueryClient()
  const labelId = useId()
  const triggerId = useId()
  // allFields, not fields: an API-only (hidden) custom field can collide just the same.
  const { allFields: customFieldDefs } = useCustomFields('candidate')

  // Step 1: server-side duplicate search (excluding the open candidate itself).
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LiteCandidate[]>([])
  const [searching, setSearching] = useState(false)
  const [searchFailed, setSearchFailed] = useState(false)
  const [other, setOther] = useState<LiteCandidate | null>(initialOther ?? null)
  // Step 2: which record remains — default: the candidate that is open now.
  const [survivorId, setSurvivorId] = useState<Id>(current.id)
  // Step 3 (X-37): the loaded maps, the colliding keys and the per-key choice.
  const [customMaps, setCustomMaps] = useState<CustomMaps | null>(null)
  const [conflicts, setConflicts] = useState<string[]>([])
  const [choices, setChoices] = useState<Record<string, ConflictChoice>>({})
  const [loadingFields, setLoadingFields] = useState(false)
  const [merging, setMerging] = useState(false)

  // The step is DERIVED, never stored: no duplicate yet → 1; maps loaded with at
  // least one collision → 3; otherwise 2. "Back" from 3 just drops the maps.
  const step: 1 | 2 | 3 = !other ? 1 : (customMaps && conflicts.length > 0) ? 3 : 2
  const survivorIsCurrent = String(survivorId) === String(current.id)
  const survivor = survivorIsCurrent ? current : (other ?? current)
  const source = survivorIsCurrent ? other : current

  // SearchSelect owns the debounce (250ms) and hands the settled term down here —
  // stable identity so its own debounce effect never re-arms on every render.
  const handleSearch = useCallback((q: string) => setQuery(q), [])

  // Fetch the capped candidate list for the current term. Aborts the in-flight
  // request on term change/unmount, and every state write is guarded by the
  // signal so a late-resolving previous term can never overwrite the new one (§9).
  useEffect(() => {
    if (other) return // picker collapsed once a duplicate is chosen
    const q = query.trim()
    if (q.length < MIN_SEARCH_LENGTH) { setResults([]); setSearchFailed(false); return }
    const ctrl = new AbortController()
    setSearching(true)
    setSearchFailed(false)
    api.get('/candidates', { params: { search: q, per_page: 8 }, signal: ctrl.signal })
      .then(res => {
        if (ctrl.signal.aborted) return
        setResults((unwrapList(res).rows as ApiRow[]).map(rowToLite).filter(c => String(c.id) !== String(current.id)))
      })
      .catch(() => { if (!ctrl.signal.aborted) setSearchFailed(true) })
      .finally(() => { if (!ctrl.signal.aborted) setSearching(false) })
    return () => ctrl.abort()
  }, [query, other, current.id])

  // One readable dropdown row per candidate: name · number · e-mail, so two people
  // with the same name are still tellable apart (the whole point of this picker).
  const pickerOptions = results.map(c => ({
    value: String(c.id),
    label: [c.name, c.code, c.email].filter(Boolean).join(' · '),
  }))
  // SearchSelect hands back the option VALUE — map it back to the record it names.
  const pickOther = (id: string) => {
    const picked = results.find(c => String(c.id) === id)
    if (picked) setOther(picked)
  }
  // The picker's own state line (loading/error/too-short). Rendered ABOVE the
  // trigger on purpose: the dropdown opens downward over everything below it, so a
  // status line under the field would be invisible in the exact moment it matters.
  const searchStatus = searchFailed ? t('merge.errSearch')
    : searching ? t('merge.searching')
    // The minimum is interpolated, never baked into the sentence (§5).
    : (query.trim().length > 0 && query.trim().length < MIN_SEARCH_LENGTH) ? t('merge.searchHint', { min: MIN_SEARCH_LENGTH })
    : ''

  // Fire the merge. The survivor's wanted custom_fields map rides along as
  // field_choices ONLY when it differs from what the survivor already holds — so the
  // no-change case is byte-for-byte the pre-X-37 request. The response is the merged
  // detail but the page refetches itself.
  const runMerge = async (maps: CustomMaps, chosen: Record<string, ConflictChoice>) => {
    if (!source || merging) return
    const merged = mergeCustomFieldMaps(maps.survivor, maps.source, chosen)
    const body = customFieldsChanged(maps.survivor, merged)
      ? { source_id: source.id, field_choices: { custom_fields: merged } }
      : { source_id: source.id }
    setMerging(true)
    try {
      await api.post(`/candidates/${survivorId}/merge`, body)
      // List + stats caches now hold a soft-deleted source row — refetch everything.
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
      notifySuccess(t('merge.done'))
      onMerged(survivorId)
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status
      notifyError(status === 403 ? t('merge.errForbidden') : t('merge.errFailed'))
      setMerging(false)
    }
  }

  // Step-2 confirm: load both records' custom_fields, then either merge straight
  // away (no collision) or open step 3 with every collision preselected on the survivor.
  // A failed load reports and stays on step 2 — never a merge on unknown values.
  const loadFieldsAndContinue = async () => {
    if (!source || loadingFields || merging) return
    setLoadingFields(true)
    try {
      const [survivorRes, sourceRes] = await Promise.all([api.get(`/candidates/${survivor.id}`), api.get(`/candidates/${source.id}`)])
      const maps: CustomMaps = { survivor: customMapOf(survivorRes), source: customMapOf(sourceRes) }
      const found = computeCustomFieldConflicts(maps.survivor, maps.source)
      const preselected = Object.fromEntries(found.map(key => [key, 'survivor' as const]))
      setCustomMaps(maps)
      setConflicts(found)
      setChoices(preselected)
      if (found.length === 0) await runMerge(maps, preselected)
    } catch {
      notifyError(t('merge.errLoadCustomFields'))
    } finally {
      setLoadingFields(false)
    }
  }

  // The confirm button routes by step: 2 loads (and maybe merges), 3 merges with the choices.
  const confirm = () => (step === 3 && customMaps) ? runMerge(customMaps, choices) : loadFieldsAndContinue()

  // "Back": from step 3 drop the maps (the survivor choice reopens, choices reset with
  // it); from step 2 drop the duplicate and return to the picker.
  const back = () => {
    if (step === 3) { setCustomMaps(null); setConflicts([]); setChoices({}); return }
    setOther(null); setSurvivorId(current.id); setCustomMaps(null)
  }

  // One radio option per side — label is the record's name, description is its meta
  // line (which record it is + number + email), so lookalikes stay tellable apart.
  const survivorOption = (c: LiteCandidate, isCurrent: boolean) => ({
    value: String(c.id),
    label: c.name,
    description: [isCurrent ? t('merge.thisRecord') : t('merge.otherRecord'), c.code, c.email].filter(Boolean).join(' · '),
  })

  const busy = loadingFields || merging

  return (
    // POPUP-SLEEP-1: migrated onto the shared FloatingPanel — draggable header,
    // remembered position; keeps its above-everything layer via Z.confirm.
    <FloatingPanel open onClose={onClose} ariaLabel={t('merge.title')}
      header={<div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: 'var(--text)' }}><GitMerge size={15} /> {t('merge.title')}</div>}
      persistKey="merge-candidate" width={460} zIndex={Z.confirm} bodyStyle={{ padding: 20 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 12 }}>{t('merge.intro', { name: current.name })}</div>

        {/* Step 1 — pick the duplicate through the house searchable dropdown
            (MERGE-PICKER-1). Label + live status share one row so the trigger never
            shifts while the menu is open (SearchSelect measures the anchor once). */}
        {step === 1 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, minHeight: 16, marginBottom: 4 }}>
              <span id={labelId} style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>{t('merge.duplicateLabel')}</span>
              <span aria-live="polite" style={{ fontSize: 11, color: searchFailed ? 'var(--color-danger)' : 'var(--text-muted)' }}>{searchStatus}</span>
            </div>
            <SearchSelect
              options={pickerOptions} selected={[]} onToggle={pickOther}
              onSearch={handleSearch} closeOnToggle width={PICKER_WIDTH}
              renderTrigger={toggle => (
                // Canon field box (G33/fieldMetrics) so this picker sits at the same
                // footprint as every other field. Named by the visible label PLUS its
                // own text — a <button> is not labelable, and pointing at the label
                // alone would REPLACE the field's own text instead of prefixing it
                // (§6, the exact convention CreatableSelect documents).
                <button type="button" onClick={toggle} id={triggerId}
                  aria-labelledby={`${labelId} ${triggerId}`} aria-haspopup="listbox"
                  style={{ ...fieldInputStyle, display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', cursor: 'pointer' }}>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                    {t('merge.searchPlaceholder')}
                  </span>
                  <ChevronDown size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} aria-hidden="true" />
                </button>
              )}
            />
          </div>
        )}

        {/* Step 2 — choose the survivor; step 3 recaps that choice read-only ("Back"
            reopens it) and lists the colliding custom fields. The danger summary
            stays under BOTH, because the confirm that archives the source lives on
            whichever step is the last one. */}
        {step >= 2 && other && source && (
          <>
            {step === 2 ? (
              <div style={{ marginBottom: 10 }}>
                {/* Visible caption doubles as the radiogroup's accessible name (matches
                    the duplicateLabel caption above it in step 1). */}
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>{t('merge.stays')}</div>
                <SegmentedControl
                  options={[survivorOption(current, true), survivorOption(other, false)]}
                  value={String(survivorId)}
                  onChange={id => setSurvivorId(id)}
                  ariaLabel={t('merge.stays')}
                />
              </div>
            ) : (
              <Caption as="div" style={{ marginBottom: 10 }}>{t('merge.staysSummary', { name: survivor.name })}</Caption>
            )}
            {step === 3 && customMaps && (
              <MergeFieldConflicts conflicts={conflicts} defs={customFieldDefs}
                survivor={{ name: survivor.name, values: customMaps.survivor }}
                source={{ name: source.name, values: customMaps.source }}
                choices={choices} onChoose={(key, choice) => setChoices(prev => ({ ...prev, [key]: choice }))} />
            )}
            <div style={{ fontSize: 12, color: 'var(--color-on-danger-bg)', background: 'var(--color-danger-bg)', border: '1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)', borderRadius: 8, padding: '8px 10px', lineHeight: 1.5, marginBottom: 12 }}>
              {t('merge.warning', { source: source.name })}
            </div>
          </>
        )}

        <MergeModalFooter showBack={!!other} onBack={back} backDisabled={busy} backLabel={t('merge.back')}
          onCancel={onClose} cancelLabel={t('merge.cancel')}
          onConfirm={confirm} confirmDisabled={!other || busy} busy={busy} confirmLabel={t('merge.confirm')} />
    </FloatingPanel>
  )
}
