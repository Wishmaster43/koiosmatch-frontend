/**
 * useTextBlockPopout — the TEKST-POPOUT-1 second-screen wiring shared by every
 * free-text drawer block (MatchTextBlock, OpportunityDescriptionBlock): one
 * draft shared between the drawer and the popped-out window via
 * useTextPopoutHost, plus the `changeDraft`/`openPopout` handlers every host
 * calls the same way. The entity/id/field triple and the draft/shown/editing
 * state itself stay owned by the caller (each block's own useState calls) —
 * this hook only wires that state into useTextPopoutHost.
 */
import { useTextPopoutHost } from './useTextPopoutHost'
import type { PopoutEntity, PopoutTextField } from '@/lib/secondScreen'
import type { Id } from '@/types/common'

interface UseTextBlockPopoutArgs {
  entity: PopoutEntity
  id: Id | undefined
  field: PopoutTextField
  draft: string
  shown: string | null | undefined
  editing: boolean
  setDraft: (html: string) => void
  setShown: (html: string) => void
  setEditing: (editing: boolean) => void
}

export function useTextBlockPopout({ entity, id, field, draft, shown, editing, setDraft, setShown, setEditing }: UseTextBlockPopoutArgs) {
  const popout = useTextPopoutHost({
    entity, id: id != null ? String(id) : '', field, value: draft, dirty: editing && draft !== (shown ?? ''),
    onDraft: (html: string) => { setDraft(html); setEditing(true) },
    onSaved: (html: string) => { setDraft(html); setShown(html); setEditing(false) },
  })
  const changeDraft = (html: string) => { setDraft(html); popout.publishDraft(html) }
  const openPopout = () => { if (id == null) return; setEditing(true); popout.open() }
  return { changeDraft, openPopout }
}
