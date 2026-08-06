/**
 * MergeSubEntityModal — absorb a duplicate LOCATION or DEPARTMENT into a survivor,
 * scope-parameterized (mirrors ScopedSollicitatiesTab's `scope` convention, §11 —
 * one shared component, never two near-identical copies). Same two-step shape as
 * MergeContactModal: (1) pick the duplicate from this customer's own list, (2)
 * choose which of the two records REMAINS. The other is soft-deleted server-side
 * (recoverable via the Gearchiveerd view — LOCATIE-SAMENVOEGEN-1 / AFDELING-
 * SAMENVOEGEN-1 merge into a soft-delete, never a hard delete).
 *
 * Route direction mirrors the contact route exactly: POST …/{DUPLICATE}/merge
 * { target_id: SURVIVOR } — the path id is the loser, the body names the winner
 * (CustomerLocationController::merge / CustomerDepartmentController::merge).
 *
 * No search endpoint, and that is the point (same reasoning as MergeContactModal):
 * the duplicate is chosen from the customer's OWN already-loaded list, filtered in
 * memory — the route is scoped to one customer and resolves both ids through it,
 * so a tenant-wide search would only ever produce cross-customer 422s.
 */
import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, GitMerge, Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import FloatingPanel from '@/components/ui/FloatingPanel'
import { Z } from '@/lib/zIndexScale'
import { BTN_H } from '@/config/buttonMetrics'
import { LOCATIONS_CHANGED_EVENT } from '../hooks/useCustomerLocations'
import { DEPARTMENTS_CHANGED_EVENT } from '../hooks/useCustomerDepartments'
import type { Id } from '@/types/common'

export type MergeSubEntityScope = 'location' | 'department'

// Only the fields the two picker cards show — never the whole record (§8).
export interface MergeCandidate { id: Id; name: string; code?: string }

export default function MergeSubEntityModal({ scope, customerId, current, others, onClose, onMerged }: {
  scope: MergeSubEntityScope
  /** Scopes the route; both records are resolved through THIS customer server-side. */
  customerId: Id
  current: MergeCandidate
  /** The customer's other locations/departments — the only merge candidates that can exist. */
  others: MergeCandidate[]
  onClose: () => void
  onMerged: (survivorId: Id) => void
}) {
  // One namespace, two key prefixes — `locations.merge.*` / `departments.merge.*`
  // mirror `contacts.merge.*` verbatim (same wording, same structure).
  const ns = scope === 'location' ? 'locations' : 'departments'
  const { t } = useTranslation('customers')

  const [query, setQuery] = useState('')
  const [other, setOther] = useState<MergeCandidate | null>(null)
  // Which record remains — defaults to the record that is open now.
  const [survivorId, setSurvivorId] = useState<Id>(current.id)
  const [merging, setMerging] = useState(false)

  // In-memory candidate filter over this customer's own list (name/reference number).
  const q = query.trim().toLowerCase()
  const results = others
    .filter(c => String(c.id) !== String(current.id))
    .filter(c => !q || [c.name, c.code].some(v => String(v ?? '').toLowerCase().includes(q)))

  // Fire the merge. The DUPLICATE goes in the path, the SURVIVOR in the body —
  // getting this backwards deletes the record the recruiter chose to keep.
  const confirmMerge = async () => {
    if (!other || merging) return
    const survivor = survivorId
    const duplicate = String(survivorId) === String(current.id) ? other.id : current.id
    setMerging(true)
    try {
      await api.post(`/customers/${customerId}/${ns}/${duplicate}/merge`, { target_id: survivor })
      // The list this modal was opened from now holds a row that no longer
      // exists — tell the owning hook to refetch (the live list AND the
      // archived sub-fetch both listen for this).
      window.dispatchEvent(new CustomEvent(scope === 'location' ? LOCATIONS_CHANGED_EVENT : DEPARTMENTS_CHANGED_EVENT))
      notifySuccess(t(`${ns}.merge.done`))
      onMerged(survivor)
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status
      notifyError(t(status === 403 ? `${ns}.merge.errForbidden` : `${ns}.merge.errFailed`))
      setMerging(false)
    }
  }

  const inputStyle: CSSProperties = { width: '100%', height: 34, padding: '0 10px 0 30px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--input-bg)', color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }

  // One selectable "which record remains" card per side.
  const survivorCard = (c: MergeCandidate, isCurrent: boolean) => {
    const active = String(survivorId) === String(c.id)
    return (
      <button type="button" key={String(c.id)} onClick={() => setSurvivorId(c.id)} aria-pressed={active}
        style={{ flex: 1, textAlign: 'left', padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
          border: `1px solid ${active ? 'var(--color-primary)' : 'var(--border)'}`,
          background: active ? 'var(--color-primary-bg)' : 'var(--surface)' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{c.name}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>{c.code ?? '—'}</div>
        <div style={{ fontSize: 10, marginTop: 4, fontWeight: active ? 600 : 400, color: active ? 'var(--color-primary)' : 'var(--text-muted)' }}>
          {active ? t(`${ns}.merge.stays`) : (isCurrent ? t(`${ns}.merge.thisRecord`) : t(`${ns}.merge.otherRecord`))}
        </div>
      </button>
    )
  }

  return (
    // POPUP-SLEEP-1: swapped the bespoke overlay/panel shell for the shared
    // draggable FloatingPanel. Opened on top of the drawer/modal band, so it
    // keeps its elevated layer via Z.confirm; per-scope persistKey.
    <FloatingPanel open onClose={onClose} ariaLabel={t(`${ns}.merge.title`)}
      persistKey={`customer-merge-${scope}`} zIndex={Z.confirm} width={460}
      bodyStyle={{ padding: 20 }}
      header={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
          <GitMerge size={15} /> {t(`${ns}.merge.title`)}
        </div>
      }>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 12 }}>{t(`${ns}.merge.intro`, { name: current.name })}</div>

        {/* Step 1 — pick the duplicate from this customer's own list. */}
        {!other && (
          <>
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
                placeholder={t(`${ns}.merge.searchPlaceholder`)} aria-label={t(`${ns}.merge.searchPlaceholder`)} style={inputStyle} />
            </div>
            <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {results.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', padding: 6 }}>
                  {others.length <= 1 ? t(`${ns}.merge.noOthers`) : t(`${ns}.merge.noResults`)}
                </div>
              )}
              {results.map(c => (
                <button key={String(c.id)} type="button" onClick={() => setOther(c)}
                  style={{ textAlign: 'left', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer' }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{c.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8, fontFamily: "'JetBrains Mono', monospace" }}>{c.code ?? ''}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Step 2 — choose the survivor + name who disappears. */}
        {other && (
          <>
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              {survivorCard(current, true)}
              {survivorCard(other, false)}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-danger)', background: 'var(--color-danger-bg)', border: '1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)', borderRadius: 8, padding: '8px 10px', lineHeight: 1.5, marginBottom: 12 }}>
              {t(`${ns}.merge.warning`, {
                source: String(survivorId) === String(current.id) ? other.name : current.name,
                target: String(survivorId) === String(current.id) ? current.name : other.name,
              })}
            </div>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          {other
            ? <button type="button" onClick={() => { setOther(null); setSurvivorId(current.id) }}
                style={{ height: BTN_H, padding: '0 12px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }}>
                {t(`${ns}.merge.back`)}
              </button>
            : <span />}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={onClose}
              style={{ height: BTN_H, padding: '0 12px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }}>
              {t(`${ns}.merge.cancel`)}
            </button>
            <button type="button" onClick={confirmMerge} disabled={!other || merging}
              style={{ display: 'flex', alignItems: 'center', gap: 6, height: BTN_H, padding: '0 14px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 8,
                background: 'var(--color-danger)', color: '#fff', cursor: !other || merging ? 'not-allowed' : 'pointer', opacity: !other || merging ? 0.5 : 1 }}>
              {merging ? <Loader2 size={13} className="animate-spin" /> : <GitMerge size={13} />} {t(`${ns}.merge.confirm`)}
            </button>
          </div>
        </div>
    </FloatingPanel>
  )
}
