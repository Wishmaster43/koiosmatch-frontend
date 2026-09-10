/**
 * ModalHeader — vacancy create modal header (title, status pills, import, close).
 * Adopts the shared AddModalHeader from components/forms, specialized for vacancies.
 *
 * TITELBALK-PILLS (Danny 27-08): status pill row reads the shared TitleBarPills atom,
 * the SAME atom AddCandidateModal's phase pills use, so the two create modals wear
 * one consistent pill style.
 *
 * EXCEL-VACATURES-1 (Danny 14-08): import toggle mirrors AddCustomerModal (KLANT-LAYOUT-3)
 * — rendered only when `canImport` (vacancies.create), icon swaps (upload → check) once a
 * file is picked, never a border repaint.
 */
import { useTranslation } from 'react-i18next'
import { PageTitle } from '@/components/ui/typography'
import AddModalHeader from '@/components/forms/AddModalHeader'
import type { LookupOption } from '@/types/common'

interface StatusOpt { value: string; label: string; color?: string }

interface Props {
  status: string
  statusOptions: StatusOpt[]
  onSelectStatus: (value: string) => void
  onClose: () => void
  canImport: boolean
  importOpen: boolean
  onToggleImport: () => void
  hasFile: boolean
}

// Vacancy create modal header — adopts the shared AddModalHeader.
export default function ModalHeader({ status, statusOptions, onSelectStatus, onClose, canImport, importOpen, onToggleImport, hasFile }: Props) {
  const { t } = useTranslation(['vacancies', 'common'])

  // Custom title element: vacancies render PageTitle as="span" directly (no wrapper div),
  // preserving the original DOM structure (BYTE-IDENTICAL rule, §3E frozen drilldown).
  const titleElement = (
    <PageTitle as="span" style={{ whiteSpace: 'nowrap' }}>
      {t('modal.title')}
    </PageTitle>
  )

  return (
    <AddModalHeader
      value={status}
      // MEASURED (round 10): tsc rejects StatusOpt[] -> LookupOption[] without this
      // cast — LookupOption's `[k: string]: unknown` index signature requires the
      // source type to declare one too (round-9's "redundant cast" claim did not
      // hold up against tsc; restored here, not removed).
      options={statusOptions as LookupOption[]}
      onChange={onSelectStatus}
      onClose={onClose}
      titleElement={titleElement}
      canImport={canImport}
      importButtonLabel={t('modal.import.title')}
      importOpen={importOpen}
      onToggleImport={onToggleImport}
      hasFile={hasFile}
      ariaLabel={t('modal.title')}
      closeAriaLabel={t('common:close')}
      containerStyle={{
        padding: '18px 22px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 16,
      }}
    />
  )
}
