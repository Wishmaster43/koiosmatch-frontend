/**
 * BranchesCard — the "Vestigingen" card (Danny r2): chips with ×, add via the
 * searchable SearchSelect. Pure presentational: the selected id list + its
 * setter live in the container.
 *
 * Trigger mirrors the drill-down's BranchSection (Danny addendum, kandidaten-
 * ronde-2): the reference-style DrawerAddButton, right-aligned, OUTSIDE the card
 * next to the "Vestigingen" heading — not the old dashed ghost button inside it.
 * Behaviour (SearchSelect + chips-with-×) is unchanged, only the trigger moved.
 */
import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import SearchSelect from '@/components/ui/SearchSelect'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import type { Id } from '@/types/common'
import { cardHead, cardBox } from './fields'

interface BranchesCardProps {
  branchIds: string[]
  setBranchIds: Dispatch<SetStateAction<string[]>>
  locations: Array<{ value: Id; label: string }>
}

export default function BranchesCard({ branchIds, setBranchIds, locations }: BranchesCardProps) {
  const { t } = useTranslation(['candidates', 'common'])
  return (
    <div style={{ gridColumn: '1 / -1' }}>
      {/* Header row: card title left, "+ Vestiging" trigger right (drill-down parity). */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
        <div style={{ ...cardHead, marginBottom: 0 }}>{t('modal.fields.branches')}</div>
        <SearchSelect triggerLabel={t('modal.fields.branchesAdd')}
          options={locations.map(o => ({ value: String(o.value), label: o.label }))}
          selected={branchIds}
          onToggle={(id: string) => setBranchIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])}
          menuAlign="right" renderTrigger={(toggleOpen: () => void) => <DrawerAddButton onClick={toggleOpen} label={t('modal.fields.branchesAdd')} />} />
      </div>
      <div style={cardBox}>
        {branchIds.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {branchIds.map(id => (
              <span key={id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '3px 8px',
                borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}>
                {locations.find(o => String(o.value) === id)?.label ?? id}
                <button type="button" onClick={() => setBranchIds(p => p.filter(x => x !== id))} aria-label={t('common:remove')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, lineHeight: 1, fontSize: 14 }}>×</button>
              </span>
            ))}
          </div>
        )}
        {branchIds.length === 0 && locations.length > 0 && (
          <p style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>{t('modal.fields.branchesAutoHint')}</p>
        )}
      </div>
    </div>
  )
}
