/**
 * NoteLinksRow — the manual koppel-picker on ONE note (NOTITIE-DOORLINK-1 write
 * side, Danny GO 28-08): soft chips for the note's current links + an add
 * affordance that opens NoteLinkPicker. Rendered under a note's body, only for a
 * host that passes the `noteLinks` capability (candidate/customer Notities tabs).
 *
 * LOCAL STATE, RESEEDED FROM THE SERVER (K-225 H2, measured 04-09): the note
 * read/list endpoint now carries a `links` field, so the host (NoteRow) seeds
 * `initialLinks` from it — MANUAL links only, the derived own-host link is
 * noise on its own host. This component still keeps its own POST/DELETE
 * results in local state for instant feedback, and RESEEDS from a fresh
 * `initialLinks` payload whenever its CONTENT changes (a refetch after an
 * unrelated edit brings the fresh server list in) — see the `seedKey` comparison
 * below, keyed on the joined link ids rather than the array's identity, so a
 * same-content re-render (a new array, same rows) never clobbers an add/remove
 * this row just did optimistically. Adjusted DURING RENDER (React's own pattern
 * for "reset state when a prop changes"), not in a useEffect — no extra
 * render-then-effect cycle, and no dependency array to get wrong.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import Button from '@/components/ui/Button'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import EntityLink from '@/components/ui/EntityLink'
import FieldNotice from '@/components/ui/FieldNotice'
import SoftChip from '@/components/ui/SoftChip'
import Spinner from '@/components/ui/Spinner'
import NoteLinkPicker from './NoteLinkPicker'
import { addNoteLink, removeNoteLink } from './noteLinksApi'
import type { NoteLinkHost, NoteLinkItem, NoteLinkPrincipalType } from './noteLinksApi'
import type { Id } from '@/types/common'

// Principal types with their own drawer page (EntityLink click-through). location/
// department/contact have no standalone drawer route (mirrors LinkedNoteRow's own
// SOURCE_PAGE map, which omits them for the same reason) — their chips render as
// plain text, never a dead link.
const LINK_PAGE: Partial<Record<NoteLinkPrincipalType, string>> = { candidate: 'candidates', customer: 'customers' }

interface NoteLinksRowProps {
  host: NoteLinkHost
  hostId: Id
  noteId: Id
  // Own-note-or-manage_all gate (mirrors the pencil/bin's canManageNote) — governs
  // both the add affordance and every chip's unlink control.
  canManage: boolean
  // Seed from the note's own `links` read field (K-225 H2) — see file docblock for the reseed behaviour.
  initialLinks?: NoteLinkItem[]
  // KOPPELEN-IN-POPOUT-1 (Danny 05-09: "we have a button above it, not in the note
  // itself"): the note ROW only DISPLAYS its chips; adding and unlinking happen in the note's
  // second-screen editor, which mounts this row with mode 'edit'.
  mode?: 'display' | 'edit'
}

// One note's link chips + add picker — see file docblock for the local-state caveat.
export default function NoteLinksRow({ host, hostId, noteId, canManage, initialLinks, mode = 'display' }: NoteLinksRowProps) {
  const { t } = useTranslation('common')
  const [links, setLinks] = useState<NoteLinkItem[]>(initialLinks ?? [])
  // Reseed from a fresh `initialLinks` payload (e.g. a refetch after an unrelated
  // edit) — keyed on the joined ids so a same-content re-render (a new array
  // instance, identical rows) never overwrites a link this row just added/removed.
  const seedKey = (initialLinks ?? []).map(l => l.id).join(',')
  const [seenSeedKey, setSeenSeedKey] = useState(seedKey)
  if (seedKey !== seenSeedKey) {
    setSeenSeedKey(seedKey)
    setLinks(initialLinks ?? [])
  }
  const [adding, setAdding] = useState(false)
  // 'add' while the picker's own POST is in flight, else the link id being removed.
  const [busyId, setBusyId] = useState<Id | 'add' | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Editing (add + unlink) only in the editor; a row that merely displays never carries a control.
  const editable = mode === 'edit' && canManage
  // Nothing to show and nothing this reader may add — render nothing (no dead affordance).
  if (links.length === 0 && !editable) return null

  // Attach a manual link, then append the server's own row (id, snapshot label).
  const handleAdd = (sel: { type: NoteLinkPrincipalType; id: Id; label: string }) => {
    setBusyId('add'); setError(null)
    addNoteLink(host, hostId, noteId, { linkable_type: sel.type, linkable_id: sel.id })
      .then(link => { setLinks(prev => [...prev, link]); setAdding(false) })
      .catch(() => setError(t('actionFailed')))
      .finally(() => setBusyId(null))
  }

  // Detach a manual link; an auto-derived one never renders an ✕ so this only fires for manual rows.
  const handleRemove = (link: NoteLinkItem) => {
    setBusyId(link.id); setError(null)
    removeNoteLink(host, hostId, noteId, link.id)
      .then(() => setLinks(prev => prev.filter(l => l.id !== link.id)))
      .catch(() => setError(t('actionFailed')))
      .finally(() => setBusyId(null))
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 6 }}>
      {links.map(link => {
        const typeLabel = t(`notes.links.type.${link.linkable_type}`)
        const labelText = link.label ?? t('notes.links.restricted')
        const page = LINK_PAGE[link.linkable_type]
        return (
          <span key={link.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
            <SoftChip color="var(--color-info)" label={
              page
                ? <EntityLink page={page} id={link.linkable_id} title={typeLabel} tone="neutral" hideIcon>{`${typeLabel} · ${labelText}`}</EntityLink>
                : `${typeLabel} · ${labelText}`
            } />
            {link.is_manual && editable && (
              <Button variant="ghost" iconOnly size="sm" onClick={() => handleRemove(link)} disabled={busyId === link.id}
                title={t('notes.links.remove')} aria-label={t('notes.links.remove')}>
                {busyId === link.id ? <Spinner size={11} /> : <X size={11} />}
              </Button>
            )}
          </span>
        )
      })}
      {editable && (
        adding
          ? <NoteLinkPicker existing={links} onAdd={handleAdd} onClose={() => setAdding(false)} busy={busyId === 'add'} />
          : <DrawerAddButton short onClick={() => setAdding(true)} label={t('notes.links.add')} />
      )}
      <FieldNotice text={error} />
    </div>
  )
}
