/**
 * AvailabilityEditor — the "Beschikbaarheid" sub-tab: records a candidate's
 * availability exceptions per date + day-part (default = available), wired to
 * /candidates/{id}/availability via useCandidateAvailability (real GET/POST/DELETE).
 * Replaces the old mock shift-agenda; the roster/agenda lives under Inroostering.
 */
import { useState, useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, X, Check, Ban } from 'lucide-react'
import { sectionBlock, sectionTitle, softPill } from './constants'
import ErrorBanner from '@/components/ui/ErrorBanner'
import Button from '@/components/ui/Button'
import { useCandidateAvailability } from '../hooks/useCandidatePlanning'
import type { AvailStatus, DayPart } from '../hooks/useCandidatePlanning'
import type { Id } from '@/types/common'
// G34: the house searchable dropdown replaces the native day-part <select>.
import CreatableSelect from '@/components/ui/CreatableSelect'

const PARTS: DayPart[] = ['day', 'morning', 'afternoon', 'evening']

// yyyy-mm-dd → dd-mm-yyyy (nl display per domain rule §3B).
function dmy(iso: string): string {
  const [y, m, d] = iso.split('-')
  return y && m && d ? `${d}-${m}-${y}` : iso
}

// Sub-tab for date+day-part availability exceptions (see the module doc above): the real API-backed hook drives add/remove, this file only renders the list and the add row.
export default function AvailabilityEditor({ candidateId }: { candidateId?: Id }) {
  const { t } = useTranslation('candidates')
  const { entries, loading, error, add, remove, reload } = useCandidateAvailability(candidateId)
  // The day-part picker has no visible label of its own (inline in the add row) —
  // a sr-only span + aria-labelledby names it for screen readers (CreatableSelect's
  // trigger is a <button>, which ignores an associated <label for>, see its own doc).
  const dayPartLabelId = useId()
  // Local add-form state (default records an "unavailable" exception — the common case).
  const [adding, setAdding] = useState(false)
  const [date,   setDate]   = useState('')
  const [part,   setPart]   = useState<DayPart>('day')
  const [status, setStatus] = useState<AvailStatus>('unavailable')
  const [reason, setReason] = useState('')

  const partLabel = (p: DayPart) => t(`planning.part_${p}`)
  const reset  = () => { setAdding(false); setDate(''); setPart('day'); setStatus('unavailable'); setReason('') }
  const submit = () => { if (!date) return; add({ date, part, status, reason: reason.trim() || undefined }); reset() }

  // Newest date first.
  const sorted = [...entries].sort((a, b) => (a.date < b.date ? 1 : -1))

  const input = { padding: '5px 9px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', color: 'var(--text)' } as const
  // Soft-tint pill (§4) — never a solid fill; shared with roles/pools/open-shift filters.
  const pill = (active: boolean) => ({ padding: '5px 12px', fontSize: 12, borderRadius: 99, cursor: 'pointer', ...softPill(active) })

  return (
    <div style={sectionBlock}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ ...sectionTitle, marginBottom: 0, flex: 1 }}>{t('planning.availability')}</span>
        {!adding && (
          <Button variant="secondary" size="sm" onClick={() => setAdding(true)} aria-label={t('planning.addAvailability')}>
            <Plus size={12} /> {t('planning.addAvailability')}
          </Button>
        )}
      </div>

      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>{t('planning.availabilityHint')}</p>

      {/* Add row */}
      {adding && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', padding: '10px 12px', marginBottom: 12,
          border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)' }}>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} aria-label={t('planning.date')} style={input} />
          <span id={dayPartLabelId} className="sr-only">{t('planning.dayPart')}</span>
          <div style={{ width: 150 }}>
            <CreatableSelect value={part} onChange={v => setPart(v as DayPart)} allowCreate={false}
              aria-labelledby={dayPartLabelId} options={PARTS.map(p => ({ value: p, label: partLabel(p) }))} style={input} />
          </div>
          {/* Segmented available/unavailable toggle — the shared softPill convention (§4), not a Button identity. */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setStatus('available')}   aria-pressed={status === 'available'}   style={pill(status === 'available')}>{t('planning.statusAvailable')}</button>
            <button onClick={() => setStatus('unavailable')} aria-pressed={status === 'unavailable'} style={pill(status === 'unavailable')}>{t('planning.statusUnavailable')}</button>
          </div>
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder={t('planning.reasonPlaceholder')} style={{ ...input, flex: 1, minWidth: 120 }} />
          <Button variant="primary" size="sm" onClick={submit} disabled={!date}>{t('common:add')}</Button>
          <Button variant="secondary" size="sm" iconOnly onClick={reset} aria-label={t('common:cancel')}>
            <X size={12} />
          </Button>
        </div>
      )}

      {/* Four states: loading / error (with retry) / empty / list. A failed load must
          never look like an honest empty roster (§0: never fabricate, never hide a
          failure), so it renders the shared error banner instead of the empty copy. */}
      {loading && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('common:loading')}</div>}
      {!loading && error && <ErrorBanner onRetry={reload}>{t('planning.availabilityLoadError')}</ErrorBanner>}
      {!loading && !error && sorted.length === 0 && !adding && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('planning.noAvailability')}</div>
      )}
      {!error && sorted.map(e => {
        const unavailable = e.status === 'unavailable'
        return (
          <div key={String(e.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', width: 92, flexShrink: 0, fontFamily: 'var(--font-mono, monospace)' }}>{dmy(e.date)}</span>
            <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 3, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 600, flexShrink: 0 }}>{partLabel(e.part)}</span>
            {/* Status = icon + text + colour (never colour alone, §6). */}
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, flexShrink: 0,
              color: unavailable ? 'var(--color-danger)' : 'var(--color-success)' }}>
              {unavailable ? <Ban size={12} /> : <Check size={12} />}
              {unavailable ? t('planning.statusUnavailable') : t('planning.statusAvailable')}
            </span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.reason}</span>
            <button onClick={() => remove(e.id)} aria-label={t('common:delete')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex' }}>
              <X size={12} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
