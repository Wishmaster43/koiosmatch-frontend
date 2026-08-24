/**
 * NoteActionTaskExtras — ASSIST-SIDEPANEEL-2 (K-159): the two task-only fields
 * in an action item's edit mode. WHO the task is for (searchable colleague
 * picker; omitted = the requester, which the server also defaults to) and WHAT
 * it is about (an entity link through the SAME AddLinkRow + vocabulary the task
 * drawer/create use — via the tasks barrel, never a deep import, §2).
 * Both values execute verbatim (K-159 contract); clearing either simply omits
 * the field from the execute body.
 */
import { useState } from 'react'
import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Link2 } from 'lucide-react'
import { useUsers } from '@/lib/queries'
import SearchSelectJs from '@/components/ui/SearchSelect'
import Button from '@/components/ui/Button'
import { Caption } from '@/components/ui/typography'
import { AddLinkRow } from '@/pages/tasks/shared'
import type { NewLink } from '@/pages/tasks/shared'
import type { NoteActionPanelItem } from './NoteActionsPanel'

type AnyProps = Record<string, unknown>
const SearchSelect = SearchSelectJs as unknown as ComponentType<AnyProps>

interface UserRow { id?: string | number; name?: string; first_name?: string; last_name?: string; [k: string]: unknown }
const userLabel = (u: UserRow) => (u.name ?? [u.first_name, u.last_name].filter(Boolean).join(' ')) || String(u.id ?? '')

export default function NoteActionTaskExtras({ item, index, onEdit }: {
  item: NoteActionPanelItem
  index: number
  onEdit: (index: number, patch: Partial<NoteActionPanelItem>) => void
}) {
  const { t } = useTranslation('common')
  const { data: users = [] } = useUsers() as { data?: UserRow[] }
  const [linking, setLinking] = useState(false)

  const userOptions = users.filter(u => u.id != null).map(u => ({ value: String(u.id), label: userLabel(u) }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
      {/* WHO — omitted means the requester (server fallback), so the trigger
          honestly says so instead of pretending a value was chosen. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <SearchSelect
          triggerLabel={item.assignee_label ?? t('notesAssist.panel.assigneeSelf', { defaultValue: 'Ikzelf (standaard)' })}
          options={userOptions} selected={item.assignee_user_id ? [item.assignee_user_id] : []} selectAll={false}
          onToggle={(v: string) => {
            const u = users.find(x => String(x.id) === v)
            onEdit(index, { assignee_user_id: v, assignee_label: u ? userLabel(u) : v })
          }} />
        {item.assignee_user_id && (
          <Button variant="ghost" size="sm" iconOnly onClick={() => onEdit(index, { assignee_user_id: undefined, assignee_label: undefined })}
            aria-label={t('notesAssist.panel.assigneeClear', { defaultValue: 'Terug naar mijzelf' })}
            title={t('notesAssist.panel.assigneeClear', { defaultValue: 'Terug naar mijzelf' })}>
            <X size={12} />
          </Button>
        )}
      </div>

      {/* WHAT — one optional entity link from the full task vocabulary. */}
      {item.link_type && item.link_id ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Caption as="span" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Link2 size={12} /> {item.link_label || `${item.link_type} #${item.link_id}`}
          </Caption>
          <Button variant="ghost" size="sm" iconOnly
            onClick={() => onEdit(index, { link_type: undefined, link_id: undefined, link_label: undefined })}
            aria-label={t('notesAssist.panel.linkClear', { defaultValue: 'Koppeling verwijderen' })}
            title={t('notesAssist.panel.linkClear', { defaultValue: 'Koppeling verwijderen' })}>
            <X size={12} />
          </Button>
        </div>
      ) : linking ? (
        <AddLinkRow existing={[]} onClose={() => setLinking(false)}
          onAdd={(link: NewLink) => { onEdit(index, { link_type: link.type, link_id: link.id, link_label: link.label }); setLinking(false) }} />
      ) : (
        <div>
          <Button variant="ghost" size="sm" onClick={() => setLinking(true)}>
            <Link2 size={12} /> {t('notesAssist.panel.linkAdd', { defaultValue: 'Koppelen aan…' })}
          </Button>
        </div>
      )}
    </div>
  )
}
