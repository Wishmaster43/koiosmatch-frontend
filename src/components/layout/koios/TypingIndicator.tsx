/**
 * TypingIndicator — the three-dot bouncing bubble shown while Koios is
 * composing a reply. Split out of KoiosPanel (§0.3 size discipline,
 * KOIOSPANEL-SPLIT-1); shares the assistant-avatar GRADIENT with KoiosMessage.
 */
import { Bot } from 'lucide-react'
import { GRADIENT } from './koiosMessageParts'

// ── Typing indicator ──────────────────────────────────────────────────────────
export default function TypingIndicator() {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
      <div style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
        background: GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Bot size={13} color="var(--color-on-accent)" />
      </div>
      <div style={{ padding: '10px 14px', borderRadius: '4px 16px 16px 16px',
        background: 'var(--surface)', border: '1px solid var(--border)',
        display: 'flex', gap: 4, alignItems: 'center' }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-violet)',
            display: 'block', animation: 'bounce 1.2s infinite', animationDelay: `${i * 0.18}s` }} />
        ))}
      </div>
    </div>
  )
}
