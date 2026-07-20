/**
 * ModalHeader — title/subtitle + the phase-choice pill row + close button.
 * Pure presentational: the selected phase value in, `onSelectStatus`/`onClose`
 * callbacks out. Phase state itself (and its default) stays in the container.
 */
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { BTN_H } from '@/config/buttonMetrics'
import type { LookupOption } from '@/types/common'

interface ModalHeaderProps {
  status: string
  pickStatuses: LookupOption[]
  selectedStatus: LookupOption | undefined
  statusLabel: string
  onSelectStatus: (value: string) => void
  onClose: () => void
}

export default function ModalHeader({ status, pickStatuses, selectedStatus, statusLabel, onSelectStatus, onClose }: ModalHeaderProps) {
  const { t } = useTranslation(['candidates', 'common'])
  return (
    <div style={{ padding: '18px 24px 14px', borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
          {selectedStatus ? `${t('modal.newPrefix')} — ${statusLabel}` : t('modal.candidateData')}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
          {status ? t('modal.fillRequired') : t('modal.statusPanelHint')}
        </div>
      </div>
      {/* Phase choice — two compact pills, same colour semantics as the old cards. */}
      <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexShrink: 0 }}>
        {pickStatuses.map(s => {
          const active = status === s.value
          return (
            <button key={s.value} onClick={() => onSelectStatus(s.value)} aria-pressed={active}
              style={{ display: 'flex', alignItems: 'center', gap: 8, height: BTN_H, padding: '0 14px',
                borderRadius: 999, cursor: 'pointer', transition: 'all 0.15s',
                border: `1.5px solid ${active ? s.color : 'var(--border)'}`,
                background: active ? s.color + '14' : 'var(--surface)' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: active ? 600 : 500, color: active ? s.color : 'var(--text)' }}>{s.label}</span>
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
