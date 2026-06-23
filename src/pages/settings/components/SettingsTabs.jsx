/**
 * SettingsTabs — the sub-tab strip for the active category. Renders nothing when
 * a category has a single item (no point in a one-tab bar). Active tab carries a
 * primary-coloured underline.
 */
import { useTranslation } from 'react-i18next'

export default function SettingsTabs({ items, active, onSelect }) {
  const { t } = useTranslation('settings')
  if (items.length <= 1) return null

  return (
    <div role="tablist" style={{
      display: 'flex', gap: 4, borderBottom: '1px solid var(--border)',
      marginBottom: 24, overflowX: 'auto',
    }}>
      {items.map(item => {
        const Icon = item.icon
        const isActive = item.id === active
        return (
          <button key={item.id} role="tab" aria-selected={isActive} onClick={() => onSelect(item.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '9px 12px',
              border: 'none', background: 'transparent', cursor: 'pointer', whiteSpace: 'nowrap',
              fontSize: 13, fontWeight: isActive ? 600 : 500,
              color: isActive ? 'var(--color-primary)' : 'var(--text-muted)',
              borderBottom: `2px solid ${isActive ? 'var(--color-primary)' : 'transparent'}`,
              marginBottom: -1, transition: 'color 0.12s',
            }}
            onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = 'var(--text-muted)' }}>
            {Icon && <Icon size={14} style={{ flexShrink: 0 }} />}
            {t(`nav.${item.id}`)}
          </button>
        )
      })}
    </div>
  )
}
