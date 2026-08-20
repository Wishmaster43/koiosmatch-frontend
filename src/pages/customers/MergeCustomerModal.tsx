/**
 * MergeCustomerModal — absorb a duplicate customer into the OPEN drawer record
 * (Danny: "samenvoegen-icoon zoals bij de kandidaat", now backed by a real route —
 * KLANT-SAMENVOEGEN-1). Step 1: search the tenant's customers for the duplicate to
 * absorb (excluding the open record). Step 2: confirm with an honest summary of what
 * happens, then fire the merge.
 *
 * ROUTE DIRECTION (measured against CustomerController::merge + CustomerMerger,
 * koiosmatch-api): the PATH id is the LOSER, the body's `target_customer_id` is the
 * SURVIVOR — the INVERSE of the candidate route (`candidates/{SURVIVOR}/merge
 * {source_id}`) and the SAME direction as the sibling customer sub-entity merges
 * (contacts/locations/departments — see MergeContactModal's docblock). Unlike the
 * candidate/contact flows, this modal never offers a "which record stays" choice: the
 * open drawer record is ALWAYS the survivor here, so the duplicate found in step 1
 * always goes in the path and the open record's own id always goes in the body. The
 * drawer therefore never has to switch records after a successful merge — only the
 * confirmation copy needs to state the direction honestly, not a picker.
 *
 * What actually happens server-side (CustomerMerger, read before writing this copy):
 * every relation that points at the duplicate (locations, departments, contacts,
 * vacancies, matches, opportunities, notes, documents, price agreements, tags, task/
 * branch links, backoffice mapping, …) is reassigned to the survivor, the survivor's
 * still-empty fields are backfilled from the duplicate, and the duplicate is then
 * SOFT-deleted (recoverable, never hard — mirrors CandidateMerger's fate).
 */
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { Search, GitMerge } from 'lucide-react'
import api, { unwrapList } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import FloatingPanel from '@/components/ui/FloatingPanel'
import Spinner from '@/components/ui/Spinner'
import { Z } from '@/lib/zIndexScale'
import { fieldInputStyle } from '@/components/forms/fieldMetrics'
import { Caption, Mono } from '@/components/ui/typography'
import type { Id } from '@/types/common'
import Button from '@/components/ui/Button'

// Only the fields the picker/summary show (§8 data minimization) — never the whole
// customer record. `city` (not `email`, unlike the candidate/contact pickers) is what
// tells same-named customers apart here, mirroring the reference number + city the
// customer TABLE already uses for that job.
interface LiteCustomer { id: Id; name: string; code?: string; city?: string }

// Minimal list-row shape from GET /customers (CustomerListResource — only what this picker reads).
interface ApiRow { id: Id; name?: string; reference_number?: string; city?: string }
const rowToLite = (r: ApiRow): LiteCustomer => ({
  id: r.id, name: r.name ?? '—', code: r.reference_number ?? undefined, city: r.city ?? undefined,
})

export default function MergeCustomerModal({ current, onClose, onMerged }: {
  /** The open drawer's customer — always the SURVIVOR (see docblock above). */
  current: LiteCustomer
  onClose: () => void
  onMerged: () => void
}) {
  const { t } = useTranslation('customers')
  const queryClient = useQueryClient()

  // Step 1: debounced duplicate search across the whole tenant (excluding the open record).
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LiteCustomer[]>([])
  const [searching, setSearching] = useState(false)
  const [duplicate, setDuplicate] = useState<LiteCustomer | null>(null)
  const [merging, setMerging] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (duplicate) return // picker collapsed once a duplicate is chosen
    const q = query.trim()
    if (q.length < 2) { setResults([]); return }
    clearTimeout(debounceRef.current)
    const ctrl = new AbortController()
    debounceRef.current = setTimeout(() => {
      setSearching(true)
      api.get('/customers', { params: { search: q, per_page: 8 }, signal: ctrl.signal })
        .then(res => setResults((unwrapList(res).rows as ApiRow[]).map(rowToLite).filter(c => String(c.id) !== String(current.id))))
        .catch(() => {})
        .finally(() => setSearching(false))
    }, 300)
    return () => { clearTimeout(debounceRef.current); ctrl.abort() }
  }, [query, duplicate, current.id])

  // Fire the merge: the DUPLICATE (picked in step 1) goes in the path, the open
  // record (always the survivor here) goes in the body — see the direction note above.
  const confirmMerge = async () => {
    if (!duplicate || merging) return
    setMerging(true)
    try {
      await api.post(`/customers/${duplicate.id}/merge`, { target_customer_id: current.id })
      // The list/stats caches now hold a soft-deleted duplicate row — refetch both.
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      notifySuccess(t('merge.done'))
      onMerged()
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status
      notifyError(status === 403 ? t('merge.errForbidden') : t('merge.errFailed'))
      setMerging(false)
    }
  }

  // Canon field style (G33/fieldMetrics) + a left inset for the search icon.
  const inputStyle: CSSProperties = { ...fieldInputStyle, paddingLeft: 30 }

  // One read-only summary card per side — NOT a toggle (unlike the candidate/contact
  // reference modals): the direction is fixed, so there is nothing to pick here.
  const infoCard = (cust: LiteCustomer, isSurvivor: boolean) => (
    <div key={String(cust.id)} style={{ flex: 1, textAlign: 'left', padding: '10px 12px', borderRadius: 10,
      border: `1px solid ${isSurvivor ? 'var(--color-primary)' : 'var(--border)'}`,
      background: isSurvivor ? 'var(--color-primary-bg)' : 'var(--surface)' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{cust.name}</div>
      <Mono as="div" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{cust.code ?? '—'}</Mono>
      {cust.city && <Caption as="div">{cust.city}</Caption>}
      {/* Text-colour accent uses the AA-contrast text token, not the raw brand primary. */}
      <div style={{ fontSize: 10, marginTop: 4, fontWeight: isSurvivor ? 600 : 400, color: isSurvivor ? 'var(--color-primary-text)' : 'var(--color-danger)' }}>
        {isSurvivor ? t('merge.staysLabel') : t('merge.duplicateLabel')}
      </div>
    </div>
  )

  return (
    // POPUP-SLEEP-1: swapped the bespoke overlay/panel shell for the shared
    // draggable FloatingPanel. Opened on top of the drawer/modal band, so it
    // keeps its elevated layer via Z.confirm.
    <FloatingPanel open onClose={onClose} ariaLabel={t('merge.title')}
      persistKey="customer-merge" zIndex={Z.confirm} width={460}
      bodyStyle={{ padding: 20 }}
      header={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
          <GitMerge size={15} /> {t('merge.title')}
        </div>
      }>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 12 }}>{t('merge.intro', { name: current.name })}</div>

        {/* Step 1 — find the duplicate to absorb. */}
        {!duplicate && (
          <>
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
                placeholder={t('merge.searchPlaceholder')} aria-label={t('merge.searchPlaceholder')} style={inputStyle} />
            </div>
            <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {searching && <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: 6 }}>{t('merge.searching')}</div>}
              {!searching && query.trim().length >= 2 && results.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', padding: 6 }}>{t('merge.noResults')}</div>
              )}
              {results.map(c => (
                <button key={String(c.id)} type="button" onClick={() => setDuplicate(c)}
                  style={{ textAlign: 'left', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer' }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{c.name}</span>
                  <Mono style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>{c.code ?? ''}</Mono>
                  {c.city && <Caption style={{ marginLeft: 8 }}>{c.city}</Caption>}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Step 2 — honest summary: the open record stays, the duplicate disappears. */}
        {duplicate && (
          <>
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              {infoCard(current, true)}
              {infoCard(duplicate, false)}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-on-danger-bg)', background: 'var(--color-danger-bg)', border: '1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)', borderRadius: 8, padding: '8px 10px', lineHeight: 1.5, marginBottom: 12 }}>
              {t('merge.warning', { source: duplicate.name, target: current.name })}
            </div>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          {duplicate
            ? <Button variant="secondary" size="sm" onClick={() => setDuplicate(null)}>
                {t('merge.back')}
              </Button>
            : <span />}
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" size="sm" onClick={onClose}>
              {t('merge.cancel')}
            </Button>
            <Button variant="danger" size="sm" onClick={confirmMerge} disabled={!duplicate || merging}>
              {merging ? <Spinner size={13} /> : <GitMerge size={13} />} {t('merge.confirm')}
            </Button>
          </div>
        </div>
    </FloatingPanel>
  )
}
