/**
 * LinkedNoteRow — the ONE note-feed row shape (NOTITIE-REFERENTIE: type chip +
 * author + date + source link), shared by NoteFeedList (the frozen candidate/
 * customer "Linked notes" section, read-only) and LinkedNotesTab (K-288, the new
 * Communicatie subtab, which adds a pencil/pop-out action cluster). Pulled out
 * of NoteFeedList.tsx so neither host re-implements the row (§11).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit2, ExternalLink, Save, X } from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import EntityLink from '@/components/ui/EntityLink'
import FieldNotice from '@/components/ui/FieldNotice'
import RichTextEditor from '@/components/ui/RichTextEditor'
import SafeHtml from '@/components/ui/SafeHtml'
import SaveButton from '@/components/ui/SaveButton'
import SoftChip from '@/components/ui/SoftChip'
import { Caption } from '@/components/ui/typography'
import { useDateFormat } from '@/lib/datetime'
import { initialsOf } from '@/lib/initials'
import { linkedNotePopoutUrl, openLinkedNotePopout, patchLinkedNote } from './linkedNoteApi'
import type { NoteFeedItem, NoteFeedSource } from '@/hooks/useNoteFeed'

// source.type (NoteSourceResolver) → the app's own page id (NavigationContext/appPages.tsx).
// 'unknown' and any future family without a mapping simply render no link (source.id is
// null for those anyway, per NoteSourceResolver::chip).
const SOURCE_PAGE: Record<string, string> = {
  candidate: 'candidates',
  customer: 'customers',
  application: 'applications',
  match: 'matches',
  opportunity: 'opportunities',
  vacancy: 'vacancies',
  task: 'tasks',
}

// The source reference: the shared EntityLink (name opens in-app, trailing icon
// opens a new tab — its own canonical faces and tooltips) while the host lives;
// a deleted/unknown host degrades to plain text with the (deleted) suffix —
// Danny's rule verbatim: the hyperlink becomes ordinary text, never a dead link.
export function SourceRef({ source }: { source: NoteFeedSource }) {
  const { t } = useTranslation('common')
  const page = SOURCE_PAGE[source.type]
  const label = source.label ?? source.type
  if (source.deleted || !page || source.id == null) {
    return <Caption as="span">{t('notes.feed.sourceDeleted', { label })}</Caption>
  }
  return <EntityLink page={page} id={source.id} title={label} tone="neutral">{label}</EntityLink>
}

interface FeedRowProps {
  item: NoteFeedItem
  noteTypes: { value: string; label: string; color?: string | null }[]
  // LinkedNotesTab-only (K-288): passing this turns on the pencil/pop-out action
  // cluster and calls back after a successful save so the feed refetches.
  // NoteFeedList never passes it — its rows stay exactly as before, read-only.
  onReload?: () => void
}

// One feed row — NOTITIE-REFERENTIE shape (type chip + author + date) + source
// ref. The chip label is server-resolved (`type_label`, CMBE 64d976ff) — never
// a raw slug; the lookup match below only supplies the tenant colour, with the
// pre-64d976ff resolve kept as the §10-tolerant label fallback.
export function FeedRow({ item, noteTypes, onReload }: FeedRowProps) {
  const { t } = useTranslation('common')
  const { formatDateTime } = useDateFormat()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item.body ?? '')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const resolved = item.type ? noteTypes.find(n => n.value === item.type || n.label === item.type) : undefined
  const chipLabel = item.type_label ?? resolved?.label ?? null
  // AUTHZ-NOTEFEED-1 (bundle H): the action cluster only exists for LinkedNotesTab
  // (onReload set) AND only where the reader may really manage this note — never
  // guessed from the author name (§3, no fake affordance).
  const canManage = Boolean(onReload) && item.can_manage === true
  const popoutUrl = canManage ? linkedNotePopoutUrl(item) : null

  // Opens the inline editor, re-seeded with the note's current server body.
  const startEdit = () => { setDraft(item.body ?? ''); setSaveError(false); setEditing(true) }
  const cancelEdit = () => { setEditing(false); setSaveError(false) }
  // Saves at the note's SOURCE route, then asks the feed to reload — the server's
  // own version (and any server-side stamping) replaces the local draft.
  const save = async () => {
    setSaving(true); setSaveError(false)
    const ok = await patchLinkedNote(item, draft)
    setSaving(false)
    if (ok) { setEditing(false); onReload?.() } else { setSaveError(true) }
  }

  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
      <Avatar initials={item.author ? initialsOf(item.author) : undefined} size={26} />
      <div style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap', gap: 4 }}>
          {/* NoteRow's title face (12/600) — EntityLink inherits its font from here, so the
              linked card never rides the drawer's larger base size again. */}
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', minWidth: 0 }}>
            <SourceRef source={item.source} />
          </span>
          {chipLabel && <SoftChip label={chipLabel} color={resolved?.color ?? 'var(--color-primary)'} round size={10} />}
          <Caption as="span" style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}>
            {item.author ? `${item.author} · ` : ''}{formatDateTime(item.created_at)}
          </Caption>
          {/* K-288 action cluster: pencil + pop-out, both gated on can_manage and hidden while editing. */}
          {canManage && !item.body_masked && !editing && (
            <Button variant="ghost" iconOnly size="sm" onClick={startEdit}
              title={t('edit')} aria-label={t('edit')} style={{ flexShrink: 0 }}>
              <Edit2 size={13} />
            </Button>
          )}
          {canManage && popoutUrl && !editing && (
            <Button variant="ghost" iconOnly size="sm" onClick={() => openLinkedNotePopout(item)}
              title={t('openSecondScreen')} aria-label={t('openSecondScreen')} style={{ flexShrink: 0 }}>
              <ExternalLink size={13} />
            </Button>
          )}
        </div>
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <RichTextEditor value={draft} onChange={setDraft} minHeight={80} />
            {saveError && <FieldNotice severity="error" text={t('notes.feed.saveError')} />}
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <SaveButton variant="primary" size="sm" iconOnly onClick={save} disabled={saving}
                title={t('save')} aria-label={t('save')}><Save size={13} /></SaveButton>
              <Button variant="secondary" size="sm" iconOnly onClick={cancelEdit} disabled={saving}
                title={t('cancel')} aria-label={t('cancel')}><X size={13} /></Button>
            </div>
          </div>
        ) : (
          // AUTHZ-NOTEFEED-1: a masked body states so honestly (italic = §4
          // empty-state voice) instead of rendering a silent blank block.
          item.body_masked
            ? <Caption as="div" style={{ fontStyle: 'italic' }}>{t('notes.feed.masked')}</Caption>
            : <SafeHtml style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }} html={item.body ?? ''} />
        )}
      </div>
    </div>
  )
}
