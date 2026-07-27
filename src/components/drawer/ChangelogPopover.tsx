import { useState, useRef, useEffect, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { History, X } from 'lucide-react'
import { sectionTitle } from '@/components/ui/SectionCard'
import { useFocusTrap } from '@/hooks/useFocusTrap'

interface ChangelogPanelProps { label: string; onClose: () => void; children: ReactNode }

/**
 * ChangelogPanel — the actual popover surface, mounted only while open. Its own
 * component (rather than an inline conditional block) so useFocusTrap (§6) attaches
 * on a fresh mount — a single always-mounted parent toggling visibility would never
 * re-run the trap effect the moment the panel first appears. `children` is the
 * entity's own content component (e.g. candidates' ChangelogTab), only rendered
 * (and thus only fetched) while this panel is mounted.
 */
function ChangelogPanel({ label, onClose, children }: ChangelogPanelProps) {
  const { t } = useTranslation('common')
  const panelRef = useFocusTrap<HTMLDivElement>(onClose)
  return (
    <div ref={panelRef} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}
      style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 400,
        width: 900, maxWidth: '92vw', maxHeight: '82vh', display: 'flex', flexDirection: 'column',
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
        boxShadow: '0 8px 28px rgba(0,0,0,0.16)', overflow: 'hidden' }}>
      {/* Popover header — title + close, supplies the chrome the bare content drops. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <span style={{ ...sectionTitle, display: 'flex', alignItems: 'center', gap: 7 }}>
          <History size={14} style={{ color: 'var(--text-muted)' }} /> {label}
        </span>
        {/* Close carries its OWN name: inherited from the candidate original, this button
            repeated the popover's label, so a screen reader announced two identical
            "Wijzigingslog" buttons — one opening, one closing (§6). */}
        <button onClick={onClose} aria-label={t('close')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex' }}>
          <X size={15} />
        </button>
      </div>
      {/* Scrollable body — the caller's own changelog content, no card of its own. */}
      <div style={{ overflowY: 'auto', padding: '12px 14px' }}>
        {children}
      </div>
    </div>
  )
}

/**
 * ChangelogPopover — THE one shared record-history affordance for every entity
 * drawer (Danny 27-07: "changelog icon in alle drill downs nalopen, moet zijn zoals
 * kandidaat drill down"; §3A(d): record history is a changelog ICON-popover in the
 * title row, never a tab). Promoted from the candidate drawer (the house standard)
 * so every entity gets the identical 900px centred panel, focus trap, Escape-to-
 * close and focus-restore instead of a hand-rolled 360px corner dropdown. This
 * shell owns only the icon/open-close/outside-click/focus-trap/global-open-request
 * chrome — each entity keeps its OWN content (fetch + field-label mapping) and
 * passes it as `children`, and its own already-translated `label`.
 */
export default function ChangelogPopover({ label, children }: { label?: string; children: ReactNode }) {
  const { t } = useTranslation('common')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  // ONE label for every entity (§5 "one source per label"). Each drawer used to pass
  // its own namespace's key, which is how the same control ended up reading
  // "Wijzigingslog" on candidates, "Wijzigingen" on four entities and "Activiteit" on
  // tasks — three different words for one affordance (measured 27-07). A caller may
  // still override, but nothing does today.
  const title = label ?? t('changelog')

  // Any drawer's system-row icon (shared NotesTab, any entity) can request the
  // changelog open via this global event — one listener now covers every adopter.
  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener('km:open-changelog', onOpen)
    return () => window.removeEventListener('km:open-changelog', onOpen)
  }, [])

  // Close on outside click while the popover is open (Escape is handled by the
  // panel's own focus trap).
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex' }}>
      {/* Toggle: a calm, muted meta-icon that tints when the popover is open. */}
      <button onClick={() => setOpen(o => !o)} title={title}
        aria-label={title} aria-haspopup="dialog" aria-expanded={open}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex',
          color: open ? 'var(--color-primary)' : 'var(--text-muted)' }}>
        <History size={14} />
      </button>

      {open && <ChangelogPanel label={title} onClose={() => setOpen(false)}>{children}</ChangelogPanel>}
    </div>
  )
}
