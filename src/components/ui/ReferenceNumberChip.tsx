/**
 * ReferenceNumberChip — the ONE place every entity drawer shows its human-readable
 * reference number (NUMMER-1): JetBrains Mono, muted, click-to-copy. Shared so the
 * candidate/customer/vacancy/match drawers stay pixel-identical (§3A "same spot").
 * Composes the generic CopyIconButton atom for the actual copy behaviour (§11).
 */
import { useTranslation } from 'react-i18next'
import CopyIconButton from './CopyIconButton'

interface ReferenceNumberChipProps {
  // The human-readable reference number (K-00123, D-4, V-12, …); nothing renders without one.
  value?: string | null
}

// The shared click-to-copy reference-number chip renders nothing without a value.
export default function ReferenceNumberChip({ value }: ReferenceNumberChipProps) {
  const { t } = useTranslation('common')
  if (!value) return null

  return (
    // The value renders INSIDE the atom's button, so the WHOLE chip stays the
    // click target it always was (Opus verify: the icon-only version shrank the
    // hit area at ~25 call sites); icon keeps its historical 10px.
    <CopyIconButton value={value} label={t('referenceNumber.copy')} copiedLabel={t('referenceNumber.copied')}
      iconSize={10} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
      {value}
    </CopyIconButton>
  )
}
