/**
 * ModalHeader — customer create modal header (icon badge, phase-in-title, phase
 * pills, import toggle, close). Adopts the shared AddModalHeader from
 * components/forms (round 10, DRY round 10 MODALS), mirroring the candidate and
 * vacancy create-modal headers instead of hand-rolling a fourth copy of the same
 * shape (round 11 DRY audit finding).
 */
import { Building2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import AddModalHeader from '@/components/forms/AddModalHeader'
import ModalHeaderIconBadge from '@/components/forms/ModalHeaderIconBadge'
import type { LookupOption } from '@/types/common'

interface PhaseOption { value: string | number; label: string; color?: string }

interface Props {
  phase: string
  phases: PhaseOption[]
  onSelectPhase: (value: string) => void
  onClose: () => void
  importOpen: boolean
  onToggleImport: () => void
  hasFile: boolean
}

// Customer create modal header — adopts the shared AddModalHeader. KLANT-LAYOUT-3:
// unlike candidates/vacancies, the toggle itself is NEVER permission-gated — the
// EntityImportCard it opens gates the upload input internally (disabled + notice),
// so the toggle always renders (canImport hardcoded true, matches the original
// unconditional button this replaced).
export default function ModalHeader({ phase, phases, onSelectPhase, onClose, importOpen, onToggleImport, hasFile }: Props) {
  const { t } = useTranslation(['customers', 'common'])
  const selectedPhase = phases.find(p => String(p.value) === String(phase))

  // Custom title element: icon badge + phase-in-title, mirroring the original
  // hand-rolled header exactly (KLANT-FASE-1: the phase reads in the title, not
  // buried in a card).
  const titleElement = (
    <>
      <ModalHeaderIconBadge>
        <Building2 size={16} color="var(--color-primary)" />
      </ModalHeaderIconBadge>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
          {selectedPhase ? `${t('modal.title')} — ${selectedPhase.label}` : t('modal.title')}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('modal.subtitle')}</div>
      </div>
    </>
  )

  return (
    <AddModalHeader
      value={String(phase ?? '')}
      options={phases.map(ph => ({ value: String(ph.value), label: ph.label, color: ph.color ?? 'var(--color-primary)' })) as LookupOption[]}
      onChange={onSelectPhase}
      onClose={onClose}
      titleElement={titleElement}
      canImport
      importButtonLabel={t('modal.import.title')}
      importOpen={importOpen}
      onToggleImport={onToggleImport}
      hasFile={hasFile}
      ariaLabel={t('modal.title')}
      closeAriaLabel={t('common:close')}
      containerStyle={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}
    />
  )
}
