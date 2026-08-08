import { useState, useRef, useEffect, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { History } from 'lucide-react'
import { sectionTitle } from '@/components/ui/SectionCard'
import FloatingPanel from '@/components/ui/FloatingPanel'

/**
 * ChangelogPopover — THE one shared record-history affordance for every entity
 * drawer (Danny 27-07: "changelog icon in alle drill downs nalopen, moet zijn zoals
 * kandidaat drill down"; §3A(d): record history is a changelog ICON-popover in the
 * title row, never a tab). This shell owns only the icon/open-close/outside-click/
 * global-open-request chrome — each entity keeps its OWN content (fetch + field-label
 * mapping) and passes it as `children`, and its own already-translated `label`.
 *
 * POPUP-SLEEP (Danny punt 19, "wijzigingslog niet sleepbaar; elke popup sleepbaar"):
 * the hand-rolled fixed/centred panel is gone — the window IS the shared
 * FloatingPanel now, so it inherits the one drag/resize/remember-my-spot engine
 * (useDraggablePanel) plus the focus trap, Escape-to-close and focus restore. It runs
 * MODELESS (`overlay={false}`): a changelog is a reference window you drag aside to
 * compare against the record underneath, so a dimming scrim would defeat its purpose.
 * `persistKey` makes it reopen where the recruiter left it.
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
  // panel's own focus trap). The panel renders INSIDE this wrapper, so a click on
  // its chrome — including a drag on the header — never counts as "outside".
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
          color: open ? 'var(--color-primary-text)' : 'var(--text-muted)' }}>
        <History size={14} />
      </button>

      <FloatingPanel open={open} onClose={() => setOpen(false)} ariaLabel={title}
        width={900} maxWidth="92vw" persistKey="changelog" overlay={false}
        bodyStyle={{ padding: '12px 14px' }}
        header={(
          <span style={{ ...sectionTitle, display: 'flex', alignItems: 'center', gap: 7 }}>
            <History size={14} style={{ color: 'var(--text-muted)' }} /> {title}
          </span>
        )}>
        {children}
      </FloatingPanel>
    </div>
  )
}
