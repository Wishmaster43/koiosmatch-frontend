/**
 * MergeEntityModal — the shared two-step merge UI behind MergeSubEntityModal
 * (location/department) and MergeContactModal: (1) pick the duplicate from the
 * customer's own already-loaded list, (2) choose which of the two records
 * REMAINS. Everything ENTITY-SPECIFIC (the request's route/body shape, the
 * i18n key prefix, the post-success side effect) stays with the caller via
 * `mergeRequest` and `i18nPrefix` — this component only owns the picking UI,
 * the survivor/duplicate resolution and the merge/error flow.
 */
import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, GitMerge } from 'lucide-react'
import { notifyError } from '@/lib/notify'
import FloatingPanel from '@/components/ui/FloatingPanel'
import Spinner from '@/components/ui/Spinner'
import SegmentedControl from '@/components/ui/SegmentedControl'
import { Z } from '@/lib/zIndexScale'
import { fieldInputStyle } from '@/components/forms/fieldMetrics'
import { tintBorder } from '@/lib/tint'
import { captionStyle,Caption, Mono } from '@/components/ui/typography'
import type { Id } from '@/types/common'
import Button from '@/components/ui/Button'

// Only the fields the picker rows/survivor control ever show — never the whole
// record (§8). `optionLabel` is the richer "Name — Function" label some callers
// need (contacts); it falls back to `name` when a caller has none.
export interface MergeCandidateRow { id: Id; name: string; optionLabel?: string; code?: string; email?: string }

export interface MergeEntityModalProps {
  /** i18n key prefix under the `customers` namespace, e.g. "locations.merge" / "contacts.merge". */
  i18nPrefix: string
  /** FloatingPanel drag/resize memory key — kept per-scope so panels don't fight over one slot. */
  persistKey: string
  current: MergeCandidateRow
  /** The customer's other records of this type — the only merge candidates that can exist. */
  others: MergeCandidateRow[]
  onClose: () => void
  onMerged: (survivorId: Id) => void
  /** Performs the actual API call + any post-success side effect (event dispatch, toast) — the entity-specific part the caller owns. */
  mergeRequest: (duplicateId: Id, survivorId: Id) => Promise<void>
}

// Two-step merge (pick the duplicate, choose the survivor), scoped to the
// caller's own already-loaded candidate list (see file header for why there is
// no search endpoint here).
export default function MergeEntityModal({ i18nPrefix, persistKey, current, others, onClose, onMerged, mergeRequest }: MergeEntityModalProps) {
  const { t } = useTranslation('customers')
  // Shorthand into this merge's own i18n branch.
  const tk = (key: string, opts?: Record<string, unknown>) => t(`${i18nPrefix}.${key}`, opts)

  const [query, setQuery] = useState('')
  const [other, setOther] = useState<MergeCandidateRow | null>(null)
  // Which record remains — defaults to the record that is open now.
  const [survivorId, setSurvivorId] = useState<Id>(current.id)
  const [merging, setMerging] = useState(false)

  // In-memory candidate filter over the caller's own list (name/code/email).
  const q = query.trim().toLowerCase()
  const results = others
    .filter(c => String(c.id) !== String(current.id))
    .filter(c => !q || [c.name, c.code, c.email].some(v => String(v ?? '').toLowerCase().includes(q)))

  // Fire the merge via the caller's request; the DUPLICATE/SURVIVOR resolution
  // stays here so every caller resolves it the same way regardless of which
  // side of the merge its own route puts the duplicate on.
  const confirmMerge = async () => {
    if (!other || merging) return
    const survivor = survivorId
    const duplicate = String(survivorId) === String(current.id) ? other.id : current.id
    setMerging(true)
    try {
      await mergeRequest(duplicate, survivor)
      onMerged(survivor)
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status
      notifyError(status === 403 ? tk('errForbidden') : tk('errFailed'))
      setMerging(false)
    }
  }

  // Canon field style (G33/fieldMetrics) + a left inset for the search icon.
  const inputStyle: CSSProperties = { ...fieldInputStyle, paddingLeft: 30 }

  // One radio option per side — label is the record's (rich, when given) name,
  // description is its meta line (which record it is + code + email).
  const survivorOption = (c: MergeCandidateRow, isCurrent: boolean) => ({
    value: String(c.id),
    label: c.optionLabel ?? c.name,
    description: [isCurrent ? tk('thisRecord') : tk('otherRecord'), c.code, c.email].filter(Boolean).join(' · '),
  })

  return (
    // POPUP-SLEEP-1: the shared draggable FloatingPanel. Opened on top of the
    // drawer/modal band, so it keeps its elevated layer via Z.confirm.
    <FloatingPanel open onClose={onClose} ariaLabel={tk('title')}
      persistKey={persistKey} zIndex={Z.confirm} width={460}
      bodyStyle={{ padding: 20 }}
      header={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
          <GitMerge size={15} /> {tk('title')}
        </div>
      }>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 12 }}>{tk('intro', { name: current.name })}</div>

        {/* Step 1 — pick the duplicate from the caller's own list. */}
        {!other && (
          <>
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
                placeholder={tk('searchPlaceholder')} aria-label={tk('searchPlaceholder')} style={inputStyle} />
            </div>
            <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {results.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', padding: 6 }}>
                  {others.length <= 1 ? tk('noOthers') : tk('noResults')}
                </div>
              )}
              {results.map(c => (
                // A two-line selectable candidate row (name + code/email), not an
                // action button — Button's fixed 28/34px height has no shape for
                // this list-row content (mirrors MergeCustomerModal's identical picker row).
                <button key={String(c.id)} type="button" onClick={() => setOther(c)}
                  // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- selectable list row, not an action button; see comment above
                  style={{ textAlign: 'left', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer' }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{c.optionLabel ?? c.name}</span>
                  {/* Mono family + caption identity: the raw captionStyle object is the sanctioned way to combine two atoms. */}
                  <Mono style={{ ...captionStyle, marginLeft: 8 }}>{c.code ?? ''}</Mono>
                  {c.email && <Caption style={{ marginLeft: 8 }}>{c.email}</Caption>}
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
              <Caption as="div" style={{ fontWeight: 600, marginBottom: 6 }}>{tk('stays')}</Caption>
              <SegmentedControl
                options={[survivorOption(current, true), survivorOption(other, false)]}
                value={String(survivorId)}
                onChange={id => setSurvivorId(id)}
                ariaLabel={tk('stays')}
              />
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-on-danger-bg)', background: 'var(--color-danger-bg)', border: tintBorder('var(--color-danger)'), borderRadius: 8, padding: '8px 10px', lineHeight: 1.5, marginBottom: 12 }}>
              {tk('warning', {
                source: String(survivorId) === String(current.id) ? other.name : current.name,
                target: String(survivorId) === String(current.id) ? current.name : other.name,
              })}
            </div>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          {other
            ? <Button variant="secondary" size="sm" onClick={() => { setOther(null); setSurvivorId(current.id) }}>
                {tk('back')}
              </Button>
            : <span />}
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" size="sm" onClick={onClose}>
              {tk('cancel')}
            </Button>
            <Button variant="danger" size="sm" onClick={confirmMerge} disabled={!other || merging}>
              {merging ? <Spinner size={13} /> : <GitMerge size={13} />} {tk('confirm')}
            </Button>
          </div>
        </div>
    </FloatingPanel>
  )
}
