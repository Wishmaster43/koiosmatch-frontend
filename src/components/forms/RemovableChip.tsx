import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'

interface RemovableChipProps {
  children: ReactNode
  onRemove: () => void
}

/**
 * RemovableChip — the plain bordered chip-with-× used by branch/location
 * multi- and single-select cards (BranchesCard, CustomerBranchesCard, …):
 * label text plus a ghost × button that clears just this one value.
 */
export default function RemovableChip({ children, onRemove }: RemovableChipProps) {
  const { t } = useTranslation()
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '3px 8px',
      borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}>
      {children}
      {/* BUTTON-GRENS-LES: a token-chip's × is chip work, not Button work — a 28px Button would
          dwarf the 11px chip; the key keeps its `common:` prefix so every adopter's test names it alike. */}
      <button type="button" onClick={onRemove} aria-label={t('common:remove')}
        // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- token-chip remove affordance (BUTTON-GRENS-LES), not a Button
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, lineHeight: 1, fontSize: 14 }}>×</button>
    </span>
  )
}
