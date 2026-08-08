/**
 * ModalHeader — title + the vacancy-status colour pill row + close button.
 * Punt 7: status moves OUT of the form entirely (was a picker inside the old
 * Publicatie card) into a header pill row, mirroring how AddCandidateModal
 * shows its phase pills top-right. Pure presentational: the selected status
 * value in, `onSelectStatus`/`onClose` callbacks out.
 */
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { BTN_H } from '@/config/buttonMetrics'

interface StatusOpt { value: string; label: string; color?: string }

interface Props {
  status: string
  statusOptions: StatusOpt[]
  onSelectStatus: (value: string) => void
  onClose: () => void
}

export default function ModalHeader({ status, statusOptions, onSelectStatus, onClose }: Props) {
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
      <button onClick={onClose} aria-label={t('common:close')}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4 }}>
        <X size={18} />
      </button>
    </div>
  )
}
