/**
 * ContactNameLink — a contact person's name rendered as a real link that opens THAT
 * contact's own drill-down on the Contactpersonen tab (Danny 28-07: "ik wil dat ik
 * vanuit de locatie ook door kan klikken op een contactpersoon en dat ik het scherm
 * krijg zoals … contactpersonen").
 *
 * Why a button and not an <a>: a contact has no page or deep link of its own — it lives
 * inside the customer drawer — so this is an in-app jump, not a URL. Styling it as a
 * link but shipping an <a href="#"> would be a lie about where it goes.
 *
 * Degrades to plain text when there is nothing to open (no id, or no handler), so a
 * caller can hand it an unresolved free-text name without producing a dead link.
 */
import type { Id } from '@/types/common'

export default function ContactNameLink({ name, id, onOpen, title }: {
  name: string
  id?: Id | null
  onOpen?: (id: Id) => void
  title?: string
}) {
  if (id == null || !onOpen) return <span style={{ fontSize: 12, color: 'var(--text)' }}>{name}</span>
  return (
    <button type="button" title={title} onClick={e => { e.stopPropagation(); onOpen(id) }}
      style={{ padding: 0, background: 'none', border: 'none', textAlign: 'left',
        // Explicit type, never `font: inherit` (Danny 28-07: "lettertype is onjuist").
        // Inside EditableFieldTable a button inherits the browser's own font stack and
        // size, so the name rendered in a different face and weight than the e-mail and
        // phone links right under it. These three numbers ARE the drawer's link style —
        // the same 12px / regular / --color-info as components/drawer/contactLinks, which
        // is the semantic hyperlink blue and NOT the tenant's brand colour.
        fontFamily: 'inherit', fontSize: 12, fontWeight: 400, lineHeight: 1.4,
        color: 'var(--color-info)', cursor: 'pointer', textDecoration: 'none',
        minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline' }}
      onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none' }}>
      {name}
    </button>
  )
}
