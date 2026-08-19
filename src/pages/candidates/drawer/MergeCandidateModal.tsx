/**
 * MergeCandidateModal — absorb a duplicate candidate into a survivor (Danny punt 4:
 * the backend merge existed, the UI never did). Step 1: pick the duplicate
 * (name/number/email so lookalikes are tellable apart). Step 2: choose which of
 * the two records REMAINS; the other is absorbed and archived (soft-delete,
 * server-side C-29). Calls POST /candidates/{survivor}/merge (verified live
 * 09-08, permission candidates.delete) and hands the survivor id back to the
 * page, which reopens it fresh.
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
import { ChevronDown, GitMerge, Loader2 } from 'lucide-react'
import api, { unwrapList } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import FloatingPanel from '@/components/ui/FloatingPanel'
import SearchSelect from '@/components/ui/SearchSelect'
import SegmentedControl from '@/components/ui/SegmentedControl'
import { Z } from '@/lib/zIndexScale'
import { fieldInputStyle } from '@/components/forms/fieldMetrics'
import type { Id } from '@/types/common'
import Button from '@/components/ui/Button'

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

  // Step 1: server-side duplicate search (excluding the open candidate itself).
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LiteCandidate[]>([])
  const [searching, setSearching] = useState(false)
  const [searchFailed, setSearchFailed] = useState(false)
  const [other, setOther] = useState<LiteCandidate | null>(initialOther ?? null)
  // Step 2: which record remains — default: the candidate that is open now.
  const [survivorId, setSurvivorId] = useState<Id>(current.id)
  const [merging, setMerging] = useState(false)

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

  // Fire the merge; the response is the merged detail but the page refetches itself.
  const confirm = async () => {
    if (!other || merging) return
    const survivor = survivorId
    const source = String(survivorId) === String(current.id) ? other.id : current.id
    setMerging(true)
    try {
      await api.post(`/candidates/${survivor}/merge`, { source_id: source })
      // List + stats caches now hold a soft-deleted source row — refetch everything.
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
      notifySuccess(t('merge.done'))
      onMerged(survivor)
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status
      notifyError(status === 403 ? t('merge.errForbidden') : t('merge.errFailed'))
      setMerging(false)
    }
  }

  // One radio option per side — label is the record's name, description is its meta
  // line (which record it is + number + email), so lookalikes stay tellable apart.
  const survivorOption = (c: LiteCandidate, isCurrent: boolean) => ({
    value: String(c.id),
    label: c.name,
    description: [isCurrent ? t('merge.thisRecord') : t('merge.otherRecord'), c.code, c.email].filter(Boolean).join(' · '),
  })

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
        {!other && (
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

        {/* Step 2 — choose the survivor + danger summary. */}
        {other && (
          <>
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
            <div style={{ fontSize: 12, color: 'var(--color-danger)', background: 'var(--color-danger-bg)', border: '1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)', borderRadius: 8, padding: '8px 10px', lineHeight: 1.5, marginBottom: 12 }}>
              {t('merge.warning', { source: String(survivorId) === String(current.id) ? other.name : current.name })}
            </div>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          {other
            ? <Button variant="secondary" size="sm" onClick={() => { setOther(null); setSurvivorId(current.id) }}>
                {t('merge.back')}
              </Button>
            : <span />}
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" size="sm" onClick={onClose}>
              {t('merge.cancel')}
            </Button>
            <Button variant="danger" size="sm" onClick={confirm} disabled={!other || merging}>
              {merging ? <Loader2 size={13} className="animate-spin" /> : <GitMerge size={13} />} {t('merge.confirm')}
            </Button>
          </div>
        </div>
    </FloatingPanel>
  )
}
