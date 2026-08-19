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
import FloatingPanel from '@/components/ui/FloatingPanel'
import SegmentedControl from '@/components/ui/SegmentedControl'
import { Z } from '@/lib/zIndexScale'
import { fieldInputStyle } from '@/components/forms/fieldMetrics'
import { CONTACTS_CHANGED_EVENT } from '../hooks/useCustomerContacts'
import { contactOptionLabel } from '@/lib/contactLabel'
import type { Contact } from '@/types/customer'
import type { Id } from '@/types/common'
import Button from '@/components/ui/Button'

// Only the fields the two picker cards show — never the whole contact record
// (§8). `role` (mapCustomer.ts's normalised function/job-title field) is
// included so same-named contacts stay distinguishable, mirroring every other
// contact picker's "Name — Function" label.
interface LiteContact { id: Id; name: string; code?: string; email?: string; role?: string }

const toLite = (c: Contact): LiteContact => ({
  id: c.id as Id,
  name: c.name,
  code: c.referenceNumber || undefined,
  email: c.email || undefined,
  role: c.role || undefined,
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

  // Canon field style (G33/fieldMetrics) + a left inset for the search icon.
  const inputStyle: CSSProperties = { ...fieldInputStyle, paddingLeft: 30 }

  // One radio option per side — label is "Name — Function" (contactOptionLabel),
  // description is the meta line (which record it is + number + email).
  const survivorOption = (c: LiteContact, isCurrent: boolean) => ({
    value: String(c.id),
    label: contactOptionLabel(c),
    description: [isCurrent ? t('contacts.merge.thisRecord') : t('contacts.merge.otherRecord'), c.code, c.email].filter(Boolean).join(' · '),
  })

  return (
    // POPUP-SLEEP-1: swapped the bespoke overlay/panel shell for the shared
    // draggable FloatingPanel. Opened on top of the drawer/modal band, so it
    // keeps its elevated layer via Z.confirm.
    <FloatingPanel open onClose={onClose} ariaLabel={t('contacts.merge.title')}
      persistKey="customer-merge-contact" zIndex={Z.confirm} width={460}
      bodyStyle={{ padding: 20 }}
      header={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
          <GitMerge size={15} /> {t('contacts.merge.title')}
        </div>
      }>
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
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{contactOptionLabel(c)}</span>
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
            <div style={{ marginBottom: 10 }}>
              {/* Visible caption doubles as the radiogroup's accessible name. */}
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>{t('contacts.merge.stays')}</div>
              <SegmentedControl
                options={[survivorOption(currentLite, true), survivorOption(other, false)]}
                value={String(survivorId)}
                onChange={id => setSurvivorId(id)}
                ariaLabel={t('contacts.merge.stays')}
              />
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
            ? <Button variant="secondary" size="sm" onClick={() => { setOther(null); setSurvivorId(current.id as Id) }}>
                {t('contacts.merge.back')}
              </Button>
            : <span />}
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" size="sm" onClick={onClose}>
              {t('contacts.merge.cancel')}
            </Button>
            <Button variant="danger" size="sm" onClick={confirmMerge} disabled={!other || merging}>
              {merging ? <Loader2 size={13} className="animate-spin" /> : <GitMerge size={13} />} {t('contacts.merge.confirm')}
            </Button>
          </div>
        </div>
    </FloatingPanel>
  )
}
