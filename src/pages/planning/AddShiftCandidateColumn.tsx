// Extracted from AddShiftModal (SIZE-SPLIT-B, zero behaviour change): the right
// column — candidate search box + result list (PLAN-LOOKUP-1).
import { Search } from 'lucide-react'
import { CandidateRow } from './AddShiftModalFields'
import { INPUT } from './addShiftFieldStyles'
import type { ShiftCandidateOption } from './hooks/useShiftLookups'

// Loose translate-function shape (avoids pulling in i18next's full generic TFunction).
type TFunction = (key: string, opts?: Record<string, unknown>) => string

export default function AddShiftCandidateColumn({
  t, searchQuery, setSearchQuery, candidatesLoading, candidatesError, candidates, candidate, setCandidate,
}: {
  t: TFunction; searchQuery: string; setSearchQuery: (v: string) => void
  candidatesLoading: boolean; candidatesError: boolean; candidates: ShiftCandidateOption[]
  candidate: ShiftCandidateOption | null; setCandidate: (c: ShiftCandidateOption) => void
}) {
  return (
    <div style={{ width: 240, flexShrink: 0, borderLeft: '1px solid var(--border)',
      background: 'var(--surface)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

      {/* Zoek */}
      <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder={t('searchCandidate')} aria-label={t('searchCandidate')}
            style={{ ...INPUT, paddingLeft: 28, fontSize: 12 }} />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.07em',
          textTransform: 'uppercase', marginBottom: 6 }}>
          {t('common:nav.candidates')}
        </div>

        {/* Four UI states — no fabricated favourite/distance ranking (see
            ./hooks/useShiftLookups header): just what the search returns. */}
        {candidatesLoading && (
          <div style={{ padding: '12px 8px', fontSize: 12, color: 'var(--text-muted)' }}>{t('common:loading')}</div>
        )}
        {!candidatesLoading && candidatesError && (
          <div style={{ padding: '12px 8px', fontSize: 12, color: 'var(--color-danger-text)' }}>{t('common:errorGeneric')}</div>
        )}
        {!candidatesLoading && !candidatesError && candidates.length === 0 && (
          <div style={{ padding: '12px 8px', fontSize: 12, color: 'var(--text-muted)' }}>{t('common:noResults')}</div>
        )}
        {!candidatesLoading && !candidatesError && candidates.map(c => (
          <CandidateRow key={c.id} candidate={c} selected={candidate?.id === c.id} onClick={() => setCandidate(c)} />
        ))}
      </div>
    </div>
  )
}
