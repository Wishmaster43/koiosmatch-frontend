/**
 * ModalHeader — candidate create modal header (title, CV entry icons, phase pills, import, close).
 * Adopts the shared AddModalHeader from components/forms with CV-specific affordances.
 *
 * CV-ENTRY-ICONS-1 (Danny 13-08): the two "from CV" banner cards moved here as two compact
 * icon affordances (upload / paste, gated on `canParseCv`) plus one short hint line.
 *
 * CAND-IMPORT-FE-1 (23-08): import toggle mirrors AddVacancyModal/AddCustomerModal (KLANT-LAYOUT-3)
 * — rendered only when `canImport` (candidates.create), same icon swap (upload → check) once a file
 * is picked, never a border repaint.
 */
import { useTranslation } from 'react-i18next'
import AddModalHeader from '@/components/forms/AddModalHeader'
import type { LookupOption } from '@/types/common'
import CvEntryIcons from './CvEntryIcons'

interface ModalHeaderProps {
  status: string
  pickStatuses: LookupOption[]
  selectedStatus: LookupOption | undefined
  statusLabel: string
  onSelectStatus: (value: string) => void
  onClose: () => void
  canParseCv: boolean
  onCvFile: (file: File) => void
  onCvText: (text: string) => void
  canImport: boolean
  importOpen: boolean
  onToggleImport: () => void
  hasFile: boolean
}

// Candidate create modal header — adopts the shared AddModalHeader with CV entry section.
export default function ModalHeader({ status, pickStatuses, selectedStatus, statusLabel, onSelectStatus, onClose,
  canParseCv, onCvFile, onCvText, canImport, importOpen, onToggleImport, hasFile }: ModalHeaderProps) {
  const { t } = useTranslation(['candidates', 'common'])

  // CV entry node — upload/paste icons + readable hint.
  const cvEntryNode = canParseCv ? (
    <>
      <CvEntryIcons onFile={onCvFile} onSubmitText={onCvText} />
      <span style={{ fontSize: 12.5, color: 'var(--text)', lineHeight: 1.35, whiteSpace: 'nowrap' }}>
        {t('modal.entryHint')}
      </span>
    </>
  ) : undefined

  return (
    <AddModalHeader
      value={status}
      options={pickStatuses}
      onChange={onSelectStatus}
      onClose={onClose}
      title={selectedStatus ? `${t('modal.newPrefix')} — ${statusLabel}` : t('modal.candidateData')}
      hint={status ? t('modal.fillRequired') : t('modal.statusPanelHint')}
      cvEntryNode={cvEntryNode}
      canImport={canImport}
      importButtonLabel={t('modal.import.title')}
      importOpen={importOpen}
      onToggleImport={onToggleImport}
      hasFile={hasFile}
      ariaLabel={t('modal.candidateData')}
      closeAriaLabel={t('common:close')}
      containerStyle={{
        padding: '18px 24px 14px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0,
      }}
    />
  )
}
