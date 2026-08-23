/**
 * NoteAssistSection — the Koios AI assist block under the note editor
 * (NOTE-ASSIST-1 F3, Danny 06-08 "geen vak voor de Koios AI verbeteringen").
 *
 * ASSIST-SIDEPANEEL-1 (Danny's 11-puntenvisie, K-155/K-157 live, 23-08):
 * the old three-button improve/summarize/actions idiom is now TWO buttons —
 * "Verwerken" (mode `process`, rewrites the text) and "Samenvatten" (mode
 * `summarize_process`, condenses it) — each a SINGLE combined call that
 * returns the text AND the action items together. The TEXT half keeps the
 * existing review→Overnemen/Verwerpen idiom (AssistTextPreview,
 * process=replace/summarize_process=append, mirroring the old
 * improve/summarize semantics 1:1). The ITEMS half never touches the note
 * body any more: the moment a combined result lands, its items are handed
 * straight to the host via `onItems` — the side panel (NoteActionsPanel) is
 * their one administration surface now, independent of whether the text
 * suggestion itself gets applied or discarded.
 *
 * `knownItems` (the panel's CURRENT items, host-supplied) rides every call as
 * `known_items` so the model dedupes against what is already on screen
 * (Danny's "dubbele punten"-klacht).
 *
 * CMFE-KOIOS-CONSISTENCY-1 (Danny 09-08): the state machine (useNoteAssist)
 * and the API call (assistNote) are the SAME implementation the shared
 * RichTextAssistBar uses on every other rich-text field (§11 one source).
 * AssistActionsResultsPanel (the OLD note-only actions wizard) is no longer
 * mounted here — the notes popup uses NoteActionsPanel instead; the shared
 * component itself stays exactly as-is for its other rich-text-field hosts.
 */
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Wand2, AlignLeft, Check, X } from 'lucide-react'
import KoiosAiMark from '@/components/ui/KoiosAiMark'
import Spinner from '@/components/ui/Spinner'
import CalloutBox from '@/components/ui/CalloutBox'
import Button from '@/components/ui/Button'
import { useNoteAssist } from './useNoteAssist'

// Lazy: the panel's import chain reaches @/i18n (self-initialising i18next) —
// eager-loading it from this section flipped host test trees onto the real
// locale bundle (same landmine RichTextAssistBar documents for its own use).
const AssistActionsResultsPanel = lazy(() => import('@/components/ui/richtext/AssistActionsResultsPanel'))
import { applyAssistResult, toPlainText } from './noteAssistApply'
import AssistTextPreview from '@/components/ui/richtext/AssistTextPreview'
import NoteKoiosModeToggle from './NoteKoiosModeToggle'
import { Caption, GroupLabel } from '@/components/ui/typography'
import { ACTION_TYPE_LABEL_NL } from './noteAssistApi'
import type { AssistCombinedMode, AssistActionItem, AssistActionType, AssistKnownItem } from './noteAssistApi'

interface NoteAssistSectionProps {
  // The editor's CURRENT html body — the text the assist call runs over, and
  // the base that summarize_process appends onto (see noteAssistApply).
  body: string
  onApply: (nextBody: string) => void
  language?: string
  // Existing note being edited → its id, forwarded into a later execute
  // request's `source.note_id` by the host's action panel; unused here directly.
  noteId?: string
  // A combined result's items, handed to the host the moment they arrive —
  // NEVER gated behind the text's own Overnemen/Verwerpen decision.
  onItems?: (items: AssistActionItem[]) => void
  // The panel's current items (title+type), sent as `known_items` so the
  // model dedupes instead of re-suggesting the same thing twice.
  knownItems?: AssistKnownItem[]
}

// Dutch fallback copy (DEFAULT-VALUE-1) — mode button label.
const MODE_LABEL_NL: Record<AssistCombinedMode, string> = { process: 'Verwerken', summarize_process: 'Samenvatten' }

// Two buttons — icon + i18n key share the mode name.
const MODES: { mode: AssistCombinedMode; icon: typeof Wand2 }[] = [
  { mode: 'process', icon: Wand2 },
  { mode: 'summarize_process', icon: AlignLeft },
]

export default function NoteAssistSection({ body, onApply, language, onItems, knownItems }: NoteAssistSectionProps) {
  const { t } = useTranslation('common')
  const { mode, status, result, errorMessage, tone, run, discard } = useNoteAssist(language)
  // Hosts WITHOUT an action panel (outreach note field, the popouts) must never
  // silently discard the items half of a combined result (Opus round, golf 4):
  // with no onItems the section keeps the items itself and renders the shared
  // execute wizard below the text — the pre-panel idiom, one source (§11).
  const [localItems, setLocalItems] = useState<AssistActionItem[]>([])
  const loading = status === 'loading'
  // Nothing to assist on yet — buttons stay VISIBLE but honestly disabled (§3: no
  // fake affordance) rather than hidden, so the section's footprint never jumps.
  const hasText = body.replace(/<[^>]*>/g, '').trim().length > 0
  const plainBody = toPlainText(body)

  // The items half of a combined result — handed to the host as soon as it
  // lands, regardless of the text half's Overnemen/Verwerpen fate. Guarded
  // against re-firing on an unrelated re-render (same result object).
  const handedRef = useRef<unknown>(null)
  useEffect(() => {
    if (status === 'success' && result && result.kind === 'combined' && handedRef.current !== result) {
      handedRef.current = result
      if (onItems) onItems(result.items)
      else setLocalItems(result.items)
    }
  }, [status, result, onItems])

  // "Overnemen" — apply the TEXT half only (process replaces, summarize_process
  // appends — see richTextAssistApply), then clear the suggestion.
  const handleApply = () => {
    if (!result || !mode || mode === 'generate') return
    onApply(applyAssistResult(body, mode, result, (type) => t(`notesAssist.actionTypes.${type}`, { defaultValue: ACTION_TYPE_LABEL_NL[type as AssistActionType] ?? type })))
    discard()
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <KoiosAiMark size={15} />
        <GroupLabel>{t('notesAssist.title', { defaultValue: 'Koios AI' })}</GroupLabel>
        <div style={{ flex: 1 }} />
        <NoteKoiosModeToggle />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        {MODES.map(({ mode: m, icon: Icon }) => (
          <Button key={m} variant={m === 'process' ? 'primary' : 'soft'} size="sm"
            onClick={() => run(m, body, knownItems ?? (localItems.length ? localItems.map(it => ({ title: it.title, type: it.type })) : undefined))} disabled={loading || !hasText}
            title={hasText ? undefined : t('notesAssist.needsText', { defaultValue: 'Schrijf eerst tekst in de notitie' })}>
            {loading && mode === m ? <Spinner size={12} /> : <Icon size={12} />}
            {t(`notesAssist.${m === 'process' ? 'process' : 'summarizeProcess'}`, { defaultValue: MODE_LABEL_NL[m] })}
          </Button>
        ))}
      </div>
      {!hasText && (
        <Caption as="div" style={{ marginBottom: 8 }}>
          {t('notesAssist.needsText', { defaultValue: 'Schrijf eerst tekst in de notitie' })}
        </Caption>
      )}

      {status === 'error' && (
        <div style={{ marginBottom: 6, marginTop: hasText ? 4 : 0 }}>
          <CalloutBox variant={tone === 'warning' ? 'warning' : 'danger'}>{errorMessage}</CalloutBox>
        </div>
      )}

      {/* Panel-less hosts: the items half renders through the SHARED execute
          wizard right here — Uitvoeren appends them as text too (the old
          idiom), Verwerpen clears them. */}
      {!onItems && localItems.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <Suspense fallback={null}>
            <AssistActionsResultsPanel
              items={localItems}
              onApplyAsText={() => onApply(applyAssistResult(body, 'actions', { kind: 'actions', items: localItems }, (type) => t(`notesAssist.actionTypes.${type}`, { defaultValue: ACTION_TYPE_LABEL_NL[type as AssistActionType] ?? type })))}
              onDiscard={() => setLocalItems([])} />
          </Suspense>
        </div>
      )}

      {/* The TEXT half only — items handed off via onItems (or kept above). */}
      {status === 'success' && result && result.kind === 'combined' && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', background: 'var(--bg)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <AssistTextPreview text={result.text} compareWith={plainBody} />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="primary" size="sm" onClick={handleApply}><Check size={13} /> {t('notesAssist.apply', { defaultValue: 'Overnemen' })}</Button>
            <Button variant="secondary" size="sm" onClick={discard}><X size={13} /> {t('notesAssist.discard', { defaultValue: 'Verwerpen' })}</Button>
          </div>
        </div>
      )}
    </div>
  )
}
