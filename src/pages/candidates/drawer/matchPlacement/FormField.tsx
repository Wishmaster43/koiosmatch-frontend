/**
 * FormField (F) — a labelled field wrapper shared by every section of the
 * placement form. Optional `error` shows the shared required-field message (the
 * 422 field mapping in useMatchPlacementForm sets these booleans). Split out of
 * MatchPlacementModal.tsx (audit R1 item 1, MUST-SPLIT).
 */
import { useTranslation } from 'react-i18next'
import { lbl, errMsg } from './styles'

export function FormField({ label, error, children }: { label: string; error?: boolean; children: React.ReactNode }) {
  const { t } = useTranslation('common')
  return <div><div style={lbl}>{label}</div>{children}{error && <div style={errMsg}>{t('required')}</div>}</div>
}
