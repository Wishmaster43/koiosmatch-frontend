/**
 * MergeContactModal — absorb a duplicate contact person into a survivor, mirroring
 * MergeCandidateModal's two-step shape: (1) pick the duplicate, (2) choose which of the
 * two records REMAINS. The other is absorbed and its row is removed server-side.
 *
 * TWO DELIBERATE DEVIATIONS from the candidate reference, both forced by the backend:
 *
 * 1. THE ROUTE DIRECTION IS INVERTED. The candidate route is
 *    POST /candidates/{SURVIVOR}/merge { source_id }, so the path id is the winner.
 *    The contact route is POST /customers/{customerId}/contacts/{DUPLICATE}/merge
 *    { target_contact_id }, so the path id is the LOSER and the body names the winner
 *    (CustomerContactController::merge — "merge this DUPLICATE contact ({id}) INTO the
 *    target"). Copying the candidate call shape here would delete the wrong person.
 *
 * 2. NO SEARCH ENDPOINT, AND THAT IS THE POINT. The duplicate is chosen from the
 *    customer's OWN already-loaded contact list, filtered in memory. The route is scoped
 *    to one customer and the backend resolves BOTH ids through that customer (a foreign
 *    id is a 404), so offering a tenant-wide search would only ever produce failures.
 *    Merging across customers is structurally unreachable from this UI.
 *
 * Merging is destructive and irreversible, so it names both people, states plainly what
 * disappears, and is permission-gated by the caller (customers.update — the backend
 * re-checks; §7).
 */
import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, GitMerge, Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { BTN_H } from '@/config/buttonMetrics'
import { CONTACTS_CHANGED_EVENT } from '../hooks/useCustomerContacts'
import type { Contact } from '@/types/customer'
import type { Id } from '@/types/common'

// Only the fields the two picker cards show — never the whole contact record (§8).
interface LiteContact { id: Id; name: string; code?: string; email?: string }

const toLite = (c: Contact): LiteContact => ({
  id: c.id as Id,
  name: c.name,
  code: c.referenceNumber || undefined,
  email: c.email || undefined,
})

export default function MergeContactModal({ customerId, current, others, onClose, onMerged }: {
  /** Scopes the route; both contacts are resolved through THIS customer server-side. */
  customerId: Id
  current: Contact
  /** The customer's other contacts — the only merge candidates that can exist. */
  others: Contact[]
  onClose: () => void
  onMerged: (survivorId: Id) => void
}) {
  const { t } = useTranslation('customers')
  const panelRef = useFocusTrap<HTMLDivElement>(onClose)

  const [query, setQuery] = useState('')
  const [other, setOther] = useState<LiteContact | null>(null)
  // Which record remains — defaults to the contact that is open now.
  const [survivorId, setSurvivorId] = useState<Id>(current.id as Id)
  const [merging, setMerging] = useState(false)

  const currentLite = toLite(current)

  // In-memory candidate filter over this customer's own contacts (name/number/email, so
  // lookalikes stay tellable apart). No request: see deviation 2 in the docblock.
  const q = query.trim().toLowerCase()
  const results = others
    .filter(c => String(c.id) !== String(current.id))
    .filter(c => !q || [c.name, c.referenceNumber, c.email].some(v => String(v ?? '').toLowerCase().includes(q)))
    .map(toLite)

  // Fire the merge. The DUPLICATE goes in the path, the SURVIVOR in the body — inverted
  // from the candidate route (docblock deviation 1); getting this backwards deletes the
  // record the recruiter chose to keep.
  const confirmMerge = async () => {
    if (!other || merging) return
    const survivor = survivorId
    const duplicate = String(survivorId) === String(current.id) ? other.id : (current.id as Id)
    setMerging(true)
    try {
      await api.post(`/customers/${customerId}/contacts/${duplicate}/merge`, { target_contact_id: survivor })
      // The list this modal was opened from now holds a row that no longer exists —
      // tell the hook that owns it to refetch (see CONTACTS_CHANGED_EVENT).
      window.dispatchEvent(new CustomEvent(CONTACTS_CHANGED_EVENT))
      notifySuccess(t('contacts.merge.done'))
      onMerged(survivor)
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status
      notifyError(status === 403 ? t('contacts.merge.errForbidden') : t('contacts.merge.errFailed'))
      setMerging(false)
    }
  }

  const inputStyle: CSSProperties = { width: '100%', height: 34, padding: '0 10px 0 30px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--input-bg)', color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }

  // One selectable "which record remains" card per side.
  const survivorCard = (c: LiteContact, isCurrent: boolean) => {
    const active = String(survivorId) === String(c.id)
    return (
      <button type="button" key={String(c.id)} onClick={() => setSurvivorId(c.id)} aria-pressed={active}
        style={{ flex: 1, textAlign: 'left', padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
          border: `1px solid ${active ? 'var(--color-primary)' : 'var(--border)'}`,
          background: active ? 'var(--color-primary-bg)' : 'var(--surface)' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{c.name}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>{c.code ?? '—'}</div>
        {c.email && <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.email}</div>}
        <div style={{ fontSize: 10, marginTop: 4, fontWeight: active ? 600 : 400, color: active ? 'var(--color-primary)' : 'var(--text-muted)' }}>
          {active ? t('contacts.merge.stays') : (isCurrent ? t('contacts.merge.thisRecord') : t('contacts.merge.otherRecord'))}
        </div>
      </button>
    )
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={t('contacts.merge.title')} tabIndex={-1}
        onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 12, padding: 20, width: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
          <GitMerge size={15} /> {t('contacts.merge.title')}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 12 }}>{t('contacts.merge.intro', { name: current.name })}</div>

        {/* Step 1 — pick the duplicate from this customer's own contacts. */}
        {!other && (
          <>
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
                placeholder={t('contacts.merge.searchPlaceholder')} aria-label={t('contacts.merge.searchPlaceholder')} style={inputStyle} />
            </div>
            <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {/* Empty state: no other contact at this customer at all vs. none matching the filter. */}
              {results.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', padding: 6 }}>
                  {others.length <= 1 ? t('contacts.merge.noOthers') : t('contacts.merge.noResults')}
                </div>
              )}
              {results.map(c => (
                <button key={String(c.id)} type="button" onClick={() => setOther(c)}
                  style={{ textAlign: 'left', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer' }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{c.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8, fontFamily: "'JetBrains Mono', monospace" }}>{c.code ?? ''}</span>
                  {c.email && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>{c.email}</span>}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Step 2 — choose the survivor + name who disappears. */}
        {other && (
          <>
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              {survivorCard(currentLite, true)}
              {survivorCard(other, false)}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-danger)', background: 'var(--color-danger-bg)', border: '1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)', borderRadius: 8, padding: '8px 10px', lineHeight: 1.5, marginBottom: 12 }}>
              {t('contacts.merge.warning', {
                source: String(survivorId) === String(current.id) ? other.name : current.name,
                target: String(survivorId) === String(current.id) ? current.name : other.name,
              })}
            </div>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          {other
            ? <button type="button" onClick={() => { setOther(null); setSurvivorId(current.id as Id) }}
                style={{ height: BTN_H, padding: '0 12px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }}>
                {t('contacts.merge.back')}
              </button>
            : <span />}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={onClose}
              style={{ height: BTN_H, padding: '0 12px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }}>
              {t('contacts.merge.cancel')}
            </button>
            <button type="button" onClick={confirmMerge} disabled={!other || merging}
              style={{ display: 'flex', alignItems: 'center', gap: 6, height: BTN_H, padding: '0 14px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 8,
                background: 'var(--color-danger)', color: '#fff', cursor: !other || merging ? 'not-allowed' : 'pointer', opacity: !other || merging ? 0.5 : 1 }}>
              {merging ? <Loader2 size={13} className="animate-spin" /> : <GitMerge size={13} />} {t('contacts.merge.confirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
