import { useTranslation } from 'react-i18next'
import SearchSelect from '@/components/ui/SearchSelect'
import DrawerAddButton from './DrawerAddButton'
import { cardHead, cardBox } from '@/components/ui/modalCards'
import type { Id } from '@/types/common'

// One selectable tenant establishment (GET /locations) offered by the picker.
export interface BranchOption { value: string; label: string }
// One branch the entity is currently linked to. Accepts a bare id/name pair —
// the membership hook (useCandidateBranches / useEntityBranches) owns the shape.
export interface EntityBranch { id?: Id; name?: string; [k: string]: unknown }

interface BranchSectionProps {
  // Already-translated strings (§5): each caller supplies its own namespace so
  // this shared component never hardcodes one entity's i18n keys.
  label: string
  addLabel?: string
  emptyLabel: string
  options?: BranchOption[]
  selectedIds?: string[]
  branches: EntityBranch[]
  onToggle?: (id: string) => void
  // Display-only mode (match drawer): the entity's branch DERIVES from its links
  // and has no membership routes — hide the add trigger and the remove × so the
  // block never offers a coupling that cannot persist (§3 no fake affordances).
  readOnly?: boolean
}

/**
 * BranchSection — links an entity (candidate, customer, …) to one or more of the
 * tenant's own establishments (branches): a searchable multi-select trigger plus
 * soft chips with a remove ×. Promoted from the candidate-only implementation
 * (§3A/§11 — Danny 28-07 "dit wil ik ook terug zien bij klanten"): ONE shared,
 * purely presentational component, adopted by every entity that links branches,
 * never a second hand-rolled copy. The membership fetch + optimistic add/remove
 * stays in each caller's own hook (useCandidateBranches for candidates —
 * membership is embedded on its own resource; useEntityBranches for customers —
 * VESTIGING-2 fase 4's dedicated GET/POST/DELETE), so this component never
 * assumes how an entity persists the coupling.
 */
export default function BranchSection({ label, addLabel, emptyLabel, options, selectedIds, branches, onToggle, readOnly }: BranchSectionProps) {
  const { t } = useTranslation('common')
  return (
    <div>
      {/* Header row: section label left, the reference-style "+" trigger OUTSIDE the
          card top-right — the popover anchors right so it stays inside the drawer. */}
      <div style={{ display: 'flex', alignItems: 'center',
        justifyContent: label ? 'space-between' : 'flex-end', marginBottom: 6 }}>
        {label ? <div style={cardHead}>{label}</div> : null}
        {!readOnly && (
          <SearchSelect triggerLabel={addLabel} options={options ?? []} selected={selectedIds ?? []} onToggle={onToggle ?? (() => {})}
            menuAlign="right" renderTrigger={(toggleOpen: () => void) => <DrawerAddButton onClick={toggleOpen} label={addLabel} />} />
        )}
      </div>
      <div style={cardBox}>
        {branches.length > 0 ? (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {branches.map((b, i) => {
              const id = String(b.id ?? b.name ?? i)
              return (
                <span key={id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '3px 8px',
                  borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}>
                  {b.name}
                  {!readOnly && (
                    <button onClick={() => onToggle?.(id)} aria-label={t('remove')}
                      // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- bare × INSIDE a chip: a nested Button would paint a second face inside the chip (PoolsSection precedent)
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, lineHeight: 1, fontSize: 14 }}>×</button>
                  )}
                </span>
              )
            })}
          </div>
        ) : (
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>{emptyLabel}</span>
        )}
      </div>
    </div>
  )
}
