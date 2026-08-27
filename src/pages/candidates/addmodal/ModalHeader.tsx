/**
 * ModalHeader — title/subtitle + the CV entry icons + the phase-choice pill row
 * + the import toggle + close button. Pure presentational: the selected phase
 * value in, `onSelectStatus`/`onClose` callbacks out. Phase state itself (and
 * its default) stays in the container.
 *
 * CV-ENTRY-ICONS-1 (Danny 13-08): the two "from CV" banner cards moved here as
 * two compact icon affordances (upload / paste, gated on `canParseCv` — both
 * parse routes need candidates.create) plus one short hint line, mirroring the
 * profile-text pop-out idiom instead of taking up a whole card each.
 *
 * CAND-IMPORT-FE-1 (23-08): adds the same top-right import toggle
 * AddVacancyModal/AddCustomerModal already carry (KLANT-LAYOUT-3) — rendered
 * only when `canImport` (candidates.create, the same right the wizard's confirm
 * step needs — §3 no fake affordance), same icon swap (upload → check) once a
 * file is picked, never a border repaint.
 */
import { useTranslation } from 'react-i18next'
import { X, Upload, CheckCircle2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import TitleBarPills from '@/components/ui/TitleBarPills'
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
  /** Whether the import toggle renders at all — gated on the candidate create right. */
  canImport: boolean
  importOpen: boolean
  onToggleImport: () => void
  /** Deepens the tint once a file is picked, so a paused import stays visible. */
  hasFile: boolean
}

// The candidate create modal's header: title, CV
// entry icons, phase-choice pills, import toggle and close — purely presentational.
export default function ModalHeader({ status, pickStatuses, selectedStatus, statusLabel, onSelectStatus, onClose,
  canParseCv, onCvFile, onCvText, canImport, importOpen, onToggleImport, hasFile }: ModalHeaderProps) {
  const { t } = useTranslation(['candidates', 'common'])
  return (
    <div style={{ padding: '18px 24px 14px', borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
      {/* KAND-KOP-1 (Danny 14-08 "tekst uitlijnen"): title and subtitle never wrap,
          so the CV hint beside them keeps one shared baseline. */}
      <div style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
          {selectedStatus ? `${t('modal.newPrefix')} — ${statusLabel}` : t('modal.candidateData')}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
          {status ? t('modal.fillRequired') : t('modal.statusPanelHint')}
        </div>
      </div>
      {/* CV entry: upload icon + paste icon, with a short hint line beside them. */}
      {canParseCv && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <CvEntryIcons onFile={onCvFile} onSubmitText={onCvText} />
          {/* Readable hint (Danny 14-08 "tekst uitschrijven, niet zo klein"), on ONE
              line now the frame is wide enough — a wrapped hint broke the alignment. */}
          <span style={{ fontSize: 12.5, color: 'var(--text)', lineHeight: 1.35, whiteSpace: 'nowrap' }}>{t('modal.entryHint')}</span>
        </div>
      )}
      {/* Phase choice — the shared TitleBarPills atom (TITELBALK-PILLS, 27-08):
          the SAME atom AddVacancyModal's status pills use, so the two create
          modals no longer wear two different pill styles. Required field: no
          `clearable`, the active pill always stays picked. */}
      <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
        <TitleBarPills options={pickStatuses} value={status} onChange={onSelectStatus} ariaLabel={t('modal.candidateData')} />
      </div>
      {/* CAND-IMPORT-FE-1: mirrors AddVacancyModal/AddCustomerModal's header
          import button 1:1 — never rendered without the create right. */}
      {canImport && (
        <Button type="button" variant="primary" onClick={onToggleImport} aria-expanded={importOpen}
          style={{ gap: 6, flexShrink: 0 }}>
          {hasFile ? <CheckCircle2 size={13} /> : <Upload size={13} />}
          {t('modal.import.title')}
        </Button>
      )}
      {/* Close — the house ghost icon button (was a hand-styled bare <button>). */}
      <Button variant="ghost" iconOnly onClick={onClose} aria-label={t('common:close')}>
        <X size={18} />
      </Button>
    </div>
  )
}
