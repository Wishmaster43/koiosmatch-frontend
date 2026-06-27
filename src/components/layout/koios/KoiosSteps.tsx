/**
 * KoiosSteps — collapsible "details" trace of the tool steps for one answer.
 * Refusals are shown visually distinct on purpose: an organisational refusal
 * (tenant setting) vs a rights refusal (the user's role) get a different colour
 * and icon, so the cause is readable at a glance.
 */
import { useState } from 'react'
import { ChevronDown, ChevronRight, Check, Ban, ShieldX } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { KoiosStep, TFn } from '../../../types/koios'

// reason → colour + icon + i18n label. Falls back to the organisational style.
const REFUSAL: Record<string, { color: string; Icon: LucideIcon; labelKey: string }> = {
  organisatorisch: { color: 'var(--color-warning)', Icon: Ban,     labelKey: 'koios.refusedOrg' },
  rechten:         { color: 'var(--color-danger)',  Icon: ShieldX, labelKey: 'koios.refusedRights' },
}

export default function KoiosSteps({ steps, t }: { steps?: KoiosStep[]; t: TFn }) {
  const [open, setOpen] = useState(false)
  if (!steps?.length) return null

  return (
    <div style={{ marginTop: 6 }}>
      <button onClick={() => setOpen((o) => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none',
                 cursor: 'pointer', padding: 0, fontSize: 11, color: 'var(--text-muted)' }}>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {t('koios.stepsToggle', { count: steps.length })}
      </button>

      {open && (
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 5 }}>
          {steps.map((s, i) => {
            const refused = s.status === 'refused'
            const meta = refused ? (REFUSAL[s.reason ?? ''] ?? REFUSAL.organisatorisch) : null
            const Icon = meta ? meta.Icon : Check
            const color = meta ? meta.color : 'var(--color-success)'
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 11 }}>
                <Icon size={13} color={color} style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontFamily: 'monospace', color: 'var(--text)' }}>{s.tool}</span>
                  {meta && <div style={{ color, marginTop: 1 }}>{t(meta.labelKey)}</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
