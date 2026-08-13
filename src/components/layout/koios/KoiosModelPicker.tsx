/**
 * KoiosModelPicker — compact model selector for the composer toolbar. Only shown
 * when the tenant has more than one selectable model; with a single model the
 * active one is used silently. Renders the tenant-facing STAND name (Snel/Slim/
 * Max), never the vendor model id (K-37, Danny 05-08: the panel used to show the
 * raw id — e.g. "claude-haiku-4-5" — while Settings already had a customer-facing
 * name for the same model). The id→tier match is the SAME shared helper the
 * Settings model picker uses (`lib/koiosModelTiers`) — never a second map. An id
 * outside that whitelist falls back to showing itself rather than a guessed label.
 */
import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { tierKeyForModel } from '@/lib/koiosModelTiers'
import type { TFn } from '@/types/koios'
// PORTAL-MARKER-1: a click inside an open portalled picker menu is never "outside".
import { isInsideDropdownPortal } from '@/lib/useDropdownPlacement'

export default function KoiosModelPicker({ models, value, onChange, t }: {
  models?: string[]; value?: string | null; onChange: (m: string) => void; t: TFn
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Resolve a raw model id to its tenant-facing stand label (ns 'koios' — the same
  // keys the Settings model picker already ships in all five locales).
  const standLabel = (id?: string | null) => {
    const key = tierKeyForModel(id)
    return key ? t(`models.tier.${key}`, { ns: 'koios' }) : (id ?? '')
  }

  // Close the menu on an outside click.
  useEffect(() => {
    const h = (e: MouseEvent) => { if (isInsideDropdownPortal(e.target as Node)) return; if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  if (!Array.isArray(models) || models.length < 2) return null

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen((o) => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 4, maxWidth: 130, padding: '4px 9px',
                 borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                 background: 'var(--hover-bg)', color: 'var(--text-muted)' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{standLabel(value)}</span>
        <ChevronDown size={10} style={{ flexShrink: 0, opacity: 0.6 }} />
      </button>

      {open && (
        <div style={{ position: 'absolute', bottom: '100%', left: 0, marginBottom: 6, minWidth: 170,
                      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
                      boxShadow: '0 4px 20px rgba(0,0,0,0.12)', overflow: 'hidden', zIndex: 50 }}>
          {models.map((m) => (
            <button key={m} onClick={() => { onChange(m); setOpen(false) }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left',
                       padding: '8px 10px', border: 'none', background: 'none', cursor: 'pointer',
                       fontSize: 12, color: 'var(--text)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--hover-bg)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}>
              <Check size={12} style={{ flexShrink: 0, opacity: m === value ? 1 : 0 }} color="var(--color-primary)" />
              <span>{standLabel(m)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
