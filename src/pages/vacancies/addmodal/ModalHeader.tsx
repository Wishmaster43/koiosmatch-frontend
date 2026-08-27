/**
 * ModalHeader — title + the vacancy-status colour pill row + close button.
 * Punt 7: status moves OUT of the form entirely (was a picker inside the old
 * Publicatie card) into a header pill row, mirroring how AddCandidateModal
 * shows its phase pills top-right. Pure presentational: the selected status
 * value in, `onSelectStatus`/`onClose` callbacks out.
 *
 * TITELBALK-PILLS (Danny 27-08): the status pill row now reads the shared
 * `components/ui/TitleBarPills` atom instead of a hand-rolled button — the
 * SAME atom AddCandidateModal's phase pills use, so the two create modals no
 * longer wear two different pill styles.
 *
 * EXCEL-VACATURES-1 (Danny 14-08, screenshot: "Excel importeren moet in de
 * pop-up + nieuwe vacature niet hier boven de tabel!!" — Excel import must be in
 * the popup + new vacancy, not here above the table!!): adds the same top-right
 * import toggle AddCustomerModal already carries (KLANT-LAYOUT-3) — rendered only
 * when `canImport` (vacancies.create, the same right the wizard's confirm step
 * needs), same soft-tint that deepens once a file is picked.
 */
import { useTranslation } from 'react-i18next'
import { X, Upload, CheckCircle2 } from 'lucide-react'
import { PageTitle } from '@/components/ui/typography'
import Button from '@/components/ui/Button'
import TitleBarPills from '@/components/ui/TitleBarPills'

interface StatusOpt { value: string; label: string; color?: string }

interface Props {
  status: string
  statusOptions: StatusOpt[]
  onSelectStatus: (value: string) => void
  onClose: () => void
  /** Whether the import toggle renders at all — gated on the vacancy create right. */
  canImport: boolean
  importOpen: boolean
  onToggleImport: () => void
  /** Deepens the tint once a file is picked, so a paused import stays visible. */
  hasFile: boolean
}

// Add-vacancy modal header: status picker, close, and the import toggle (gated on canImport, tinted deeper once a file is picked — see the props' doc comments above).
export default function ModalHeader({ status, statusOptions, onSelectStatus, onClose, canImport, importOpen, onToggleImport, hasFile }: Props) {
  const { t } = useTranslation(['vacancies', 'common'])
  return (
    <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0,
      display: 'flex', alignItems: 'center', gap: 16 }}>
      {/* nowrap: the title must stay on ONE line so the status pills sit fully
          right (Danny 08-08) instead of being pushed against a wrapped title. */}
      <PageTitle as="span" style={{ whiteSpace: 'nowrap' }}>{t('modal.title')}</PageTitle>
      {/* Status pill row — the shared TitleBarPills atom. A genuinely empty
          lookup renders no pills at all (never a fabricated highlight),
          matching the honest "nothing picked" state. Required field: no
          `clearable`, the active pill always stays picked. */}
      <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
        <TitleBarPills options={statusOptions} value={status} onChange={onSelectStatus} ariaLabel={t('modal.title')} />
      </div>
      {/* EXCEL-VACATURES-1: mirrors AddCustomerModal's header import button 1:1 —
          same placement and accessible-name pattern; the paused-import signal is
          the ICON SWAP (upload → check), the canon — never a border repaint.
          Never rendered without the create right (§3: no fake affordance). */}
      {canImport && (
        <Button type="button" variant="primary" onClick={onToggleImport} aria-expanded={importOpen}
          style={{ gap: 6, flexShrink: 0 }}>
          {hasFile ? <CheckCircle2 size={13} /> : <Upload size={13} />}
          {t('modal.import.title')}
        </Button>
      )}
      <Button onClick={onClose} aria-label={t('common:close')} variant="ghost" iconOnly>
        <X size={18} />
      </Button>
    </div>
  )
}
