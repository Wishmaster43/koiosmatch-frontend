/**
 * useSeedLabel — the React side of LOOKUP-I18N-1: one hook for the render sites that
 * show a lookup label the server embedded in a RECORD (application.phaseLabel,
 * candidate.stageLabel, a pool name on a row) rather than reading the lookup itself.
 * Seeded defaults render in the user language, tenant text stays as typed.
 *
 * Returns a stable callback, so a column config that depends on it does not rebuild
 * every render (SEED-IDENTITY-1).
 */
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { translateSeedLabel } from './lookupSeedI18n'
import type { SeedTranslatable } from './lookupSeedI18n'

// Stable label-translator callback for records that embed a lookup label directly, so a column config depending on it never rebuilds every render (see file header).
export function useSeedLabel() {
  const { t } = useTranslation('common')
  return useCallback(
    (family: string, item: SeedTranslatable): string => translateSeedLabel(t, family, item),
    [t],
  )
}
