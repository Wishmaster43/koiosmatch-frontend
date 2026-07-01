import { useTranslation } from 'react-i18next'
import SearchSelect from '@/components/ui/SearchSelect'
import { useCandidateBranches } from '../hooks/useCandidateDrawerData'
import { sectionBlock } from './constants'
import type { Candidate } from '@/types/candidate'

/**
 * BranchSection — links the candidate to one or more branches (C-4, M2M).
 * Presentational: the option fetch + optimistic add/remove persistence live in
 * useCandidateBranches (§3). Chips carry { id, name }; the shared SearchSelect
 * drives the multi-select by branch id.
 */
export default function BranchSection({ c }: { c: Candidate }) {
  const { t } = useTranslation('candidates')
  const { branches, options, selectedIds, toggle } = useCandidateBranches(c)

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 6 }}>{t('sections.branch')}</div>
      <div style={sectionBlock}>
      {branches.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {branches.map((b, i) => {
            const id = String(b.id ?? b.name ?? i)
            return (
              <span key={id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '3px 8px',
                borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}>
                {b.name}
                <button onClick={() => toggle(id)} aria-label={t('common:remove')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, lineHeight: 1, fontSize: 14 }}>×</button>
              </span>
            )
          })}
        </div>
      )}
      {/* Shared searchable multi-select — toggles branch membership by id (DUP-1). */}
      <SearchSelect triggerLabel={t('sections.branchLink')} options={options} selected={selectedIds} onToggle={toggle} />
      </div>
    </div>
  )
}
