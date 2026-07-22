/**
 * AvailabilityEditor — the "Beschikbaarheid" sub-tab: records a candidate's
 * availability exceptions per date + day-part (default = available), wired to
 * /candidates/{id}/availability via useCandidateAvailability (real GET/POST/DELETE).
 * Replaces the old mock shift-agenda; the roster/agenda lives under Inroostering.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, X, Check, Ban } from 'lucide-react'
import { sectionBlock, sectionTitle, softPill } from './constants'
import { useCandidateAvailability } from '../hooks/useCandidatePlanning'
import type { AvailStatus, DayPart } from '../hooks/useCandidatePlanning'
import type { Id } from '@/types/common'

const PARTS: DayPart[] = ['day', 'morning', 'afternoon', 'evening']

// yyyy-mm-dd → dd-mm-yyyy (nl display per domain rule §3B).
function dmy(iso: string): string {
  const [y, m, d] = iso.split('-')
  return y && m && d ? `${d}-${m}-${y}` : iso
}

export default function AvailabilityEditor({ candidateId }: { candidateId?: Id }) {
  const { t } = useTranslation('candidates')
  const { entries, loading, add, remove } = useCandidateAvailability(candidateId)
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

  const input = { padding: '5px 9px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, outline: 'none', background: 'var(--bg)', color: 'var(--text)' } as const
  // Soft-tint pill (§4) — never a solid fill; shared with roles/pools/open-shift filters.
  const pill = (active: boolean) => ({ padding: '5px 12px', fontSize: 12, borderRadius: 99, cursor: 'pointer', ...softPill(active) })

  return (
    <div style={sectionBlock}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ ...sectionTitle, marginBottom: 0, flex: 1 }}>{t('planning.availability')}</span>
        {!adding && (
          <button onClick={() => setAdding(true)} aria-label={t('planning.addAvailability')}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', fontSize: 11, fontWeight: 500,
              border: '1px solid var(--border)', borderRadius: 7, background: 'var(--bg)', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <Plus size={12} /> {t('planning.addAvailability')}
          </button>
        )}
      </div>

      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>{t('planning.availabilityHint')}</p>

      {/* Add row */}
      {adding && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', padding: '10px 12px', marginBottom: 12,
          border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)' }}>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} aria-label={t('planning.date')} style={input} />
          <select value={part} onChange={e => setPart(e.target.value as DayPart)} aria-label={t('planning.dayPart')} style={{ ...input, cursor: 'pointer' }}>
            {PARTS.map(p => <option key={p} value={p}>{partLabel(p)}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setStatus('available')}   style={pill(status === 'available')}>{t('planning.statusAvailable')}</button>
            <button onClick={() => setStatus('unavailable')} style={pill(status === 'unavailable')}>{t('planning.statusUnavailable')}</button>
          </div>
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder={t('planning.reasonPlaceholder')} style={{ ...input, flex: 1, minWidth: 120 }} />
          <button onClick={submit} disabled={!date}
            style={{ padding: '5px 12px', fontSize: 12, fontWeight: 600, borderRadius: 7, border: 'none',
              background: 'var(--color-primary)', color: '#fff', cursor: date ? 'pointer' : 'not-allowed', opacity: date ? 1 : 0.5 }}>
            {t('common:add')}
          </button>
          <button onClick={reset} aria-label={t('common:cancel')}
            style={{ padding: '5px 7px', border: '1px solid var(--border)', borderRadius: 7, background: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}>
            <X size={12} />
          </button>
        </div>
      )}

      {/* Four states: loading / empty / list */}
      {loading && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('common:loading')}</div>}
      {!loading && sorted.length === 0 && !adding && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('planning.noAvailability')}</div>
      )}
      {sorted.map(e => {
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
