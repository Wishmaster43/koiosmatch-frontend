/**
 * EditableRichTextField — one rich-text prose block with its OWN in-place edit
 * (pencil → save/cancel), mirroring the candidate profile-text pattern
 * (candidates/drawer/ProfileTab.tsx): SafeHtml display (sanitised HTML, italic
 * muted placeholder when empty), RichTextEditor + expand/collapse + a clear
 * button while editing. Generic on purpose — the customer's Teksten section
 * (Beschrijving/Wervingsproblemen) and the department's Omschrijving both reuse
 * this ONE component instead of forking the pencil/save/cancel dance per field
 * (Danny 2026-07-14; house rule: every multi-line prose field is a rich-text
 * block, never a bare textarea).
 */
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit2, Save, X, Trash2, ExternalLink } from 'lucide-react'
import RichTextEditor from '@/components/ui/RichTextEditor'
import SafeHtml from '@/components/ui/SafeHtml'
import Button from '@/components/ui/Button'
import { useTextPopoutHost } from '@/hooks/useTextPopoutHost'
import type { PopoutEntity, PopoutTextField } from '@/lib/secondScreen'
import type { GenerateEntity } from '@/components/ui/richtext/richTextAssistApi'

interface Props {
  // Section label shown above the block (e.g. "Beschrijving").
  label: string
  // Current sanitised-HTML value (empty string = nothing filled in yet).
  value: string
  // Persist the new HTML — the caller wires this to its own onUpdate/PATCH flow.
  onSave: (html: string) => void
  // TEKST-POPOUT-1 (K3/K5, batch 5): optional second-screen affordance — one icon
  // in this block's title row, mirroring the candidate profile text (ProfileTab).
  // Omitted (the default) → no icon, unchanged behaviour for every other caller
  // of this shared field (locations, and any future prose block without a
  // second-screen route yet).
  popout?: { entity: PopoutEntity; id: string | number; field: PopoutTextField }
  // KOIOS-GENERATE-1: which entity/id the "Genereer met Koios" button targets.
  // Omitted → no Genereer button (§3, no fake affordance) — see the department
  // popout's own docblock for why it stays omitted there today.
  assistGenerate?: { entity: GenerateEntity; id: string }
}

export default function EditableRichTextField({ label, value, onSave, popout, assistGenerate }: Props) {
  const { t } = useTranslation('common')
  const [editing,  setEditing]  = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [draft,    setDraft]    = useState(value)
  // Last PERSISTED value — what ✕ restores, and what a same-value effect below
  // must NOT clobber a popped-out window's own more-recent save with (mirrors
  // ProfileTab's savedSummary/lastRecordSummary pair).
  const [saved, setSaved] = useState(value)
  const lastPropValue = useRef(value)

  // Enter edit mode with a fresh draft (in case `value` changed since last edit).
  const start  = () => { setDraft(value); setEditing(true) }
  const save   = () => { onSave(draft); setSaved(draft); setEditing(false) }
  const cancel = () => { setDraft(saved); setEditing(false) }

  // TEKST-POPOUT-1: both windows edit ONE draft — publish local edits, adopt the
  // popout's. `active` no-ops the hook entirely until the icon is actually
  // clicked, so a field nobody pops out opens no BroadcastChannel (only wired
  // when the `popout` prop is present).
  const popoutHost = useTextPopoutHost({
    entity: popout?.entity ?? 'customer', id: popout?.id ?? '', field: popout?.field ?? 'companyText',
    value: draft, dirty: draft !== saved,
    onDraft: html => { setDraft(html); setEditing(true) },
    onSaved: html => { setDraft(html); setSaved(html); setEditing(false) },
  })
  const changeDraft = (html: string) => { setDraft(html); if (popout) popoutHost.publishDraft(html) }
  const openPopout = () => { setEditing(true); popoutHost.open() }

  // Adopt the caller's value only when IT changes (a reload, a save elsewhere)
  // and no edit is in progress — never overwrite text a popped-out window just
  // saved with this component's now-stale copy of `value`.
  useEffect(() => {
    if (value === lastPropValue.current) return
    lastPropValue.current = value
    setSaved(value)
    if (!editing) setDraft(value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const blockStyle: CSSProperties = { borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface)' }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>{label}</span>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {/* Clear the text (edit mode only) — same spot as the candidate profile text. */}
          {editing && (
            <Button variant="dangerSoft" iconOnly size="sm" onClick={() => changeDraft('')} title={t('clear')} aria-label={t('clear')}>
              <Trash2 size={13} />
            </Button>
          )}
          {/* TEKST-POPOUT-1: second screen — same icon + footprint the candidate
              profile text uses, only rendered when the caller opted in. */}
          {popout && (
            <Button variant="secondary" iconOnly size="sm" onClick={openPopout} title={t('openSecondScreen')} aria-label={t('openSecondScreen')}>
              <ExternalLink size={13} />
            </Button>
          )}
          {editing ? (
            <div style={{ display: 'flex', gap: 4 }}>
              <Button variant="primary" iconOnly size="sm" onClick={save} title={t('save')} aria-label={t('save')}><Save size={13} /></Button>
              <Button variant="secondary" iconOnly size="sm" onClick={cancel} title={t('cancel')} aria-label={t('cancel')}><X size={13} /></Button>
            </div>
          ) : (
            <Button variant="secondary" iconOnly size="sm" onClick={start} title={t('edit')} aria-label={t('edit')}><Edit2 size={13} /></Button>
          )}
        </div>
      </div>
      {editing
        ? <RichTextEditor value={draft} onChange={changeDraft} expanded={expanded} onToggleExpand={() => setExpanded(v => !v)}
            assistGenerate={assistGenerate} />
        : (value
            ? <div style={{ ...blockStyle, padding: '10px 12px', maxHeight: 220, overflow: 'auto' }}>
                <SafeHtml html={value} style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }} />
              </div>
            // Empty state renders italic + muted (§4: italic reserved for placeholder text).
            : <div style={{ ...blockStyle, padding: '10px 12px', fontSize: 12, fontStyle: 'italic', color: 'var(--text-muted)' }}>
                {t('customers:richText.empty')}
              </div>)}
    </div>
  )
}
