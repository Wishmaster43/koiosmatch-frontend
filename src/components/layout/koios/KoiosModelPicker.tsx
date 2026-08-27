/**
 * KoiosModelPicker — compact model selector for the composer toolbar. Only shown
 * when the tenant has more than one selectable model; with a single model the
 * active one is used silently. Renders the tenant-facing STAND name (Snel/Slim/
 * Max), never the vendor model id (K-37, Danny 05-08: the panel used to show the
 * raw id — e.g. "claude-haiku-4-5" — while Settings already had a customer-facing
 * name for the same model). KOIOS-MODEL-VOCAB-1 (27-08): the label/hint come from
 * the server's own `models.options[]` (`lib/koiosModelTiers`'s `resolveModelLabel`)
 * — the SAME vocabulary the Settings model picker reads, never a second hand-
 * maintained id→tier map. An id outside that list falls back to the shared tier
 * substring match, then to showing itself.
 */
import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { resolveModelLabel, resolveModelHint, type KoiosModelOption } from '@/lib/koiosModelTiers'
import type { TFn } from '@/types/koios'
// PORTAL-MARKER-1: a click inside an open portalled picker menu is never "outside".
import { isInsideDropdownPortal } from '@/lib/useDropdownPlacement'

// Model-tier picker for the Koios panel; see the module doc comment above for the
// shared options vocabulary this shares with the Settings model picker.
export default function KoiosModelPicker({ models, options, value, onChange, t }: {
  models?: string[]; options?: KoiosModelOption[]; value?: string | null; onChange: (m: string) => void; t: TFn
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Resolve a model/flavour id to its tenant-facing stand label — server option
  // label first, the shared tier map as fallback (see module doc comment).
  const standLabel = (id?: string | null) => resolveModelLabel(id, options, t)

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
        // HUISSTIJL-1: dropdown menu — z-popover ladder tier, shadow-float role.
        <div style={{ position: 'absolute', bottom: '100%', left: 0, marginBottom: 6, minWidth: 170,
                      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
                      boxShadow: 'var(--shadow-float)', overflow: 'hidden', zIndex: 'var(--z-popover)' }}>
          {models.map((m) => {
            // AI-MODELS-1: the tenant-facing cost hint (calm caption, never a number) —
            // translated for a known flavour, the server's own hint otherwise.
            const hint = resolveModelHint(m, options, t)
            return (
              <button key={m} onClick={() => { onChange(m); setOpen(false) }}
                style={{ width: '100%', display: 'flex', alignItems: 'flex-start', gap: 8, textAlign: 'left',
                         padding: '8px 10px', border: 'none', background: 'none', cursor: 'pointer',
                         fontSize: 12, color: 'var(--text)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--hover-bg)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}>
                <Check size={12} style={{ flexShrink: 0, marginTop: 2, opacity: m === value ? 1 : 0 }} color="var(--color-primary)" />
                <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span>{standLabel(m)}</span>
                  {hint && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{hint}</span>}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
