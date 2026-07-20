import { useTranslation } from 'react-i18next'
import SearchSelect from '@/components/ui/SearchSelect'
import DrawerAddButton from './DrawerAddButton'
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
      {/* Header row (Danny consistency-sweep clarification): section label left,
          the reference-style "+" trigger OUTSIDE the card top-right — the popover
          anchors right so it stays inside the drawer. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>{t('sections.branch')}</div>
        <SearchSelect triggerLabel={t('sections.branchLink')} options={options} selected={selectedIds} onToggle={toggle}
          menuAlign="right" renderTrigger={(toggleOpen: () => void) => <DrawerAddButton onClick={toggleOpen} label={t('sections.branchLink')} />} />
      </div>
      <div style={sectionBlock}>
      {branches.length > 0 ? (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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
      ) : (
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('sections.branchEmpty')}</span>
      )}
      </div>
    </div>
  )
}
