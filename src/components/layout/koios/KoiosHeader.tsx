/**
 * KoiosHeader — the panel's top bar: brand + connection dot, "Nieuwe chat",
 * expand/collapse and close. Split out of KoiosPanel (§0.3 size discipline) —
 * purely presentational, all state/handlers arrive as props.
 */
import { Plus, Sparkles, Maximize2, Minimize2, X } from 'lucide-react'
import type { TFn } from '@/types/koios'

// gradient used for the assistant avatar + user bubble + this header's brand dot.
const GRADIENT = 'linear-gradient(135deg,var(--color-primary),#8B5CF6)'

interface KoiosHeaderProps {
  connected: boolean
  expanded: boolean
  onNewChat: () => void
  onToggleExpanded: () => void
  onClose?: () => void
  t: TFn
}

export default function KoiosHeader({ connected, expanded, onNewChat, onToggleExpanded, onClose, t }: KoiosHeaderProps) {
  return (
    <div style={{ height: 56, borderBottom: '1px solid var(--sidebar-border)', flexShrink: 0,
      display: 'flex', alignItems: 'center', padding: '0 14px', gap: 8 }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
        background: GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Sparkles size={13} color="white" />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--sidebar-text)', lineHeight: 1.2 }}>Koios</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', display: 'block',
            background: connected ? 'var(--color-success)' : 'var(--color-warning)' }} />
          <span style={{ fontSize: 10, fontWeight: 500, color: connected ? 'var(--color-success)' : 'var(--color-warning)' }}>
            {t(connected ? 'koios.online' : 'koios.offline')}
          </span>
        </div>
      </div>
      <button onClick={onNewChat} title={t('koios.newChat')}
        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 9px', fontSize: 10,
          fontWeight: 600, background: 'rgba(99,102,241,0.12)', color: 'var(--color-primary)',
          border: 'none', borderRadius: 6, cursor: 'pointer', transition: 'background 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.22)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(99,102,241,0.12)'}>
        <Plus size={10} /> {t('koios.newChatShort')}
      </button>
      <button onClick={onToggleExpanded} aria-label={t(expanded ? 'collapse' : 'expand')} aria-expanded={expanded}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--sidebar-muted)',
          padding: 4, display: 'flex', borderRadius: 6, transition: 'background 0.1s' }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--sidebar-hover)'}
        onMouseLeave={e => e.currentTarget.style.background = 'none'}>
        {expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
      </button>
      <button onClick={onClose} aria-label={t('common:close', { defaultValue: 'Sluiten' })}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--sidebar-muted)',
          padding: 4, display: 'flex', borderRadius: 6, transition: 'background 0.1s' }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--sidebar-hover)'}
        onMouseLeave={e => e.currentTarget.style.background = 'none'}>
        <X size={15} />
      </button>
    </div>
  )
}
