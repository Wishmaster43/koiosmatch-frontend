/**
 * KoiosHeader — the panel's top bar: brand + connection dot, "Nieuwe chat",
 * expand/collapse and close. Split out of KoiosPanel (§0.3 size discipline) —
 * purely presentational, all state/handlers arrive as props.
 *
 * CONNECT-1 (Danny 22-08: "Knopje niet bij Koios AI doet ook niets??" — the button
 * next to Koios AI doesn't do anything either?? — on the "Niet gekoppeld" ("Not
 * connected") indicator): `connected` is derived in KoiosPanel from
 * GET /ai/koios/settings' `status.claude_configured` + `status.api_ok` — the
 * exact surface that configures it is Settings → AI → Koios
 * (pages/settings/sections/koios/KoiosStatusCard.jsx). So the disconnected
 * state is now a REAL affordance (`onConfigure`) instead of a dead-looking
 * chip, jumping straight there; the connected state stays a plain status span
 * (nothing to click when it's fine).
 */
import { Plus, Sparkles, Maximize2, Minimize2, X } from 'lucide-react'
import Button from '@/components/ui/Button'
import type { TFn } from '@/types/koios'
import { GRADIENT } from './koiosMessageParts'

// gradient used for the assistant avatar + user bubble + this header's brand dot.


interface KoiosHeaderProps {
  connected: boolean
  expanded: boolean
  onNewChat: () => void
  onToggleExpanded: () => void
  onClose?: () => void
  // Jumps to the Koios connection's own settings screen — only ever called from
  // the disconnected state's indicator (see CONNECT-1 above).
  onConfigure: () => void
  t: TFn
}

// See the file's top doc above for the connection-dot/CONNECT-1 background; purely presentational, all state arrives as props.
export default function KoiosHeader({ connected, expanded, onNewChat, onToggleExpanded, onClose, onConfigure, t }: KoiosHeaderProps) {
  return (
    <div style={{ height: 56, borderBottom: '1px solid var(--sidebar-border)', flexShrink: 0,
      display: 'flex', alignItems: 'center', padding: '0 14px', gap: 8 }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
        background: GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* GRADIENT embeds the tenant accent — read the on-accent token, not a hardcoded white. */}
        <Sparkles size={13} color="var(--color-on-accent)" />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--sidebar-text)', lineHeight: 1.2 }}>Koios</div>
        {connected ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', display: 'block', background: 'var(--color-success)' }} />
            {/* -text twin, not the raw fill: var(--color-success) reads 3.0:1 as ink, an AA fail (§4). */}
            <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--color-success-text)' }}>{t('koios.online')}</span>
          </div>
        ) : (
          // CONNECT-1: a compact inline control, not the shared Button — it must
          // still read as the SAME status row as the "online" span above (just
          // now clickable); Button's fixed 28px footprint would break that
          // parity between the two states.
          <button type="button" onClick={onConfigure} aria-label={t('koios.offlineConnect')} title={t('koios.offlineConnect')}
            // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- compact inline status control mirroring the plain "online" span sibling; a 28px Button would break the parity between the two states
            style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none',
              borderRadius: 4, padding: '1px 2px', margin: '-1px -2px', cursor: 'pointer', font: 'inherit', transition: 'background 0.1s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--sidebar-hover)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none' }}>
            <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', display: 'block', background: 'var(--color-warning)' }} />
            {/* -text twin, not the raw fill: var(--color-warning) reads 3.19:1 as light ink (§4). */}
            <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--color-warning-text)' }}>{t('koios.offline')}</span>
          </button>
        )}
      </div>
      <Button variant="primary" size="sm" onClick={onNewChat} title={t('koios.newChat')}>
        <Plus size={12} /> {t('koios.newChatShort')}
      </Button>
      <Button variant="ghost" size="sm" iconOnly onClick={onToggleExpanded} aria-label={t(expanded ? 'collapse' : 'expand')} aria-expanded={expanded}>
        {expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
      </Button>
      <Button variant="ghost" size="sm" iconOnly onClick={onClose} aria-label={t('common:close', { defaultValue: 'Sluiten' })}>
        <X size={15} />
      </Button>
    </div>
  )
}
