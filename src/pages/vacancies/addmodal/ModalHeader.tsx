/**
 * ModalHeader — title + the vacancy-status colour pill row + close button.
 * Punt 7: status moves OUT of the form entirely (was a picker inside the old
 * Publicatie card) into a header pill row, mirroring how AddCandidateModal
 * shows its phase pills top-right. Pure presentational: the selected status
 * value in, `onSelectStatus`/`onClose` callbacks out.
 *
 * EXCEL-VACATURES-1 (Danny 14-08, screenshot: "Excel importeren moet in de
 * pop-up + nieuwe vacature niet hier boven de tabel!!"): adds the same top-right
 * import toggle AddCustomerModal already carries (KLANT-LAYOUT-3) — rendered only
 * when `canImport` (vacancies.create, the same right the wizard's confirm step
 * needs), same soft-tint that deepens once a file is picked.
 */
import { useTranslation } from 'react-i18next'
import { X, Upload } from 'lucide-react'
import { BTN_H } from '@/config/buttonMetrics'

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

export default function ModalHeader({ status, statusOptions, onSelectStatus, onClose, canImport, importOpen, onToggleImport, hasFile }: Props) {
  const { t } = useTranslation(['vacancies', 'common'])
  return (
    <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0,
      display: 'flex', alignItems: 'center', gap: 16 }}>
      {/* nowrap: the title must stay on ONE line so the status pills sit fully
          right (Danny 08-08) instead of being pushed against a wrapped title. */}
      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap' }}>{t('modal.title')}</span>
      {/* Status pill row — a read-and-pick control, never a form field. A
          genuinely empty lookup renders no pills at all (never a fabricated
          highlight), matching the honest "nothing picked" state. */}
      <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexShrink: 0, flexWrap: 'wrap' }}>
        {statusOptions.map(s => {
          const active = status === s.value
          const c = s.color ?? 'var(--color-primary)'
          return (
            <button key={s.value} type="button" onClick={() => onSelectStatus(s.value)} aria-pressed={active} title={s.label}
              style={{ display: 'flex', alignItems: 'center', gap: 8, height: BTN_H, padding: '0 14px',
                borderRadius: 999, cursor: 'pointer', transition: 'all 0.15s',
                border: `1.5px solid ${active ? c : 'var(--border)'}`,
                background: active ? `color-mix(in srgb, ${c} 14%, transparent)` : 'var(--surface)' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: c, flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: active ? 600 : 500, color: active ? c : 'var(--text)' }}>{s.label}</span>
            </button>
          )
        })}
      </div>
      {/* EXCEL-VACATURES-1: mirrors AddCustomerModal's header import button 1:1 —
          same placement, soft-tint and accessible-name pattern. Never rendered
          without the create right (§3: no fake affordance). */}
      {canImport && (
        <button type="button" onClick={onToggleImport} aria-expanded={importOpen}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: BTN_H, padding: '0 12px',
            flexShrink: 0, borderRadius: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 600,
            color: 'var(--color-primary-text)',
            border: `1px solid color-mix(in srgb, var(--color-primary) ${hasFile ? 50 : 32}%, transparent)`,
            background: `color-mix(in srgb, var(--color-primary) ${hasFile ? 16 : 8}%, transparent)` }}>
          <Upload size={13} />
          {t('modal.import.title')}
        </button>
      )}
      <button onClick={onClose} aria-label={t('common:close')}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4 }}>
        <X size={18} />
      </button>
    </div>
  )
}
