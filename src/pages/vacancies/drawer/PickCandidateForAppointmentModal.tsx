import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrapList } from '@/lib/api'
import FloatingPanel from '@/components/ui/FloatingPanel'
import SearchSelect from '@/components/ui/SearchSelect'
import Button from '@/components/ui/Button'
import { Caption } from '@/components/ui/typography'
import { PlanIntakeModal } from '@/pages/candidates/shared'
import type { Id } from '@/types/common'

// Server round-trip page size — mirrors useSearchOptions' own per-request cap
// (pages/applications/addmodal), never the whole tenant candidate table.
const PAGE_SIZE = 25

interface CandidateOption { id: Id; label: string }

// Minimal /candidates row shape this picker reads (tolerant of gaps, mirrors
// MergeCandidateModal's own local row type — only the fields this picker shows).
interface ApiRow { id: Id; first_name?: string; last_name?: string; name?: string; function_title?: string; city?: string }
const rowToOption = (r: ApiRow): CandidateOption => {
  // A nameless row still gets a visible, pickable label (never " · detail" or
  // an empty invisible option — Opus F8): fall back to the id.
  const name = (r.name ?? [r.first_name, r.last_name].filter(Boolean).join(' ')) || String(r.id)
  const detail = [r.function_title, r.city].filter(Boolean).join(' · ')
  return { id: r.id, label: detail ? `${name} · ${detail}` : name }
}

/**
 * PickCandidateForAppointmentModal (VACDRAWER-ACTIONS-1) — booking an
 * appointment from the vacancy drawer has the vacancy PRESET but, unlike every
 * other PlanIntakeModal caller (candidate/application drawer, vacancy
 * applicant row), no candidate yet: this vacancy's Afspraken ("Appointments")
 * tab lists
 * appointments across ALL candidates, so "+ Afspraak" ("+ Appointment") must
 * ask WHICH one first.
 *
 * Step 1 (this component's own body) picks the candidate through the house
 * SERVER-SEARCHED dropdown — SearchSelect's own canonical single-pick FIELD
 * face (`closeOnToggle`, no `renderTrigger` override: §4 — "a dropdown trigger
 * is a form field, it inherits its face from SearchSelect, never a hand-rolled
 * copy per call site") rather than a client-capped list like useVacancyOptions:
 * a tenant table of hundreds of candidates must stay searchable, never
 * silently truncated. An honest cap hint (shared common:shownOf, mirrors
 * reports/EntityListDrawer) shows whenever the unfiltered/narrowed page is
 * smaller than the real total, so "first 25" never quietly reads as "all of them".
 *
 * Step 2 hands the pick straight to the SAME shared PlanIntakeModal every
 * other surface uses, vacancy preset via `defaultVacancyId` — this is explicit
 * CONTEXT (opened from this vacancy), not a guess, so no Koios badge applies
 * (§3A). No separate "continue" click: picking a candidate immediately swaps
 * this step's own FloatingPanel for PlanIntakeModal's, mirroring
 * MergeCandidateModal's step1→step2 transition.
 */
export default function PickCandidateForAppointmentModal({ vacancyId, onClose, onCreated }: {
  vacancyId: Id
  onClose: () => void
  onCreated: () => void
}) {
  const { t } = useTranslation(['vacancies', 'common'])

  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<CandidateOption[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  // 'forbidden' is its own state (Opus F2, the documented 08-08 P1: a 403, a
  // 5xx and a dropped connection must never read identically) — plus a retry
  // tick so a transient failure is recoverable without reopening the modal.
  const [failed, setFailed] = useState<false | 'error' | 'forbidden'>(false)
  const [retryTick, setRetryTick] = useState(0)
  const [picked, setPicked] = useState<CandidateOption | null>(null)

  // Server-searched candidate list — refetches on every debounced query edit
  // (SearchSelect debounces 250ms itself, mirrors useSearchOptions); an empty
  // query still fetches the plain first page instead of showing nothing, so
  // the picker is browsable before typing a single character.
  useEffect(() => {
    if (picked) return
    const ctrl = new AbortController()
    setLoading(true); setFailed(false)
    const trimmed = query.trim()
    api.get('/candidates', {
      params: trimmed ? { search: trimmed, per_page: PAGE_SIZE } : { per_page: PAGE_SIZE },
      signal: ctrl.signal,
    })
      .then(r => {
        const list = unwrapList<ApiRow>(r)
        setOptions(list.rows.map(rowToOption))
        setTotal(list.total)
      })
      .catch(err => {
        if (err?.code === 'ERR_CANCELED') return
        setFailed((err as { response?: { status?: number } })?.response?.status === 403 ? 'forbidden' : 'error')
      })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [query, picked, retryTick])

  const pickerOptions = options.map(o => ({ value: String(o.id), label: o.label }))
  // Resolves the picked option's full candidate row from the loaded search results.
  const pickCandidate = (id: string) => {
    const opt = options.find(o => String(o.id) === id)
    if (opt) setPicked(opt)
  }

  // Honest cap hint (VACDRAWER-ACTIONS-1, the "first 25 of 292" concern): reuse
  // the shared common:shownOf phrasing everywhere else already uses, never a
  // bespoke second wording for the same idea.
  const capHint = total > options.length ? t('common:shownOf', { shown: options.length, total }) : null

  return (
    <>
      {!picked && (
        <FloatingPanel open onClose={onClose} title={t('appointmentsTab.pickCandidate.title')}
          ariaLabel={t('appointmentsTab.pickCandidate.title')} persistKey="pick-appointment-candidate" width={420}>
          <div style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, minHeight: 16, marginBottom: 4 }}>
              {/* HUISSTIJL-1: the field label is the shared Caption atom (11/muted);
                  only the weight rides via style, the fontSize/colour identity never
                  gets re-declared locally. */}
              <Caption as="span" style={{ fontWeight: 600 }}>
                {t('appointmentsTab.pickCandidate.label')}
              </Caption>
              {/* Cap hint lives HERE, above the trigger (Opus F3 — the open
                  dropdown covers everything below it, MergeCandidateModal's own
                  documented trap); failures split honest 403 vs error+retry. */}
              <Caption as="span" aria-live="polite" style={failed === 'error' || failed === 'forbidden' ? { color: 'var(--color-danger-text)' } : undefined}>
                {failed === 'forbidden' ? t('appointmentsTab.pickCandidate.noAccess')
                  : failed === 'error' ? (
                    <>
                      {t('appointmentsTab.pickCandidate.error')}{' '}
                      {/* eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- inline retry link INSIDE an 11px status caption; Button sm's 28px footprint cannot sit in this line (§14 r7 necessity, mirrors the V7 calm-text-link precedent) */}
                      <button type="button" onClick={() => setRetryTick(n => n + 1)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'inherit', textDecoration: 'underline' }}>
                        {t('common:error.retry')}
                      </button>
                    </>
                  ) : loading ? t('common:loadingShort') : capHint}
              </Caption>
            </div>
            {/* No custom renderTrigger: SearchSelect's own default closeOnToggle
                face IS the canon single-pick field trigger (§4) — triggerLabel
                shows the placeholder since this component unmounts the moment a
                candidate is picked (there is no "selected" state to reflect back). */}
            <SearchSelect
              options={pickerOptions} selected={[]} onToggle={pickCandidate}
              onSearch={setQuery} closeOnToggle width={380}
              triggerLabel={t('appointmentsTab.pickCandidate.placeholder')}
              triggerAriaLabel={t('appointmentsTab.pickCandidate.label')}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <Button variant="secondary" size="sm" onClick={onClose}>{t('common:cancel')}</Button>
            </div>
          </div>
        </FloatingPanel>
      )}
      {picked && (
        <PlanIntakeModal candidateId={picked.id} defaultVacancyId={vacancyId} mode="appointment"
          onClose={onClose} onCreated={onCreated} />
      )}
    </>
  )
}
