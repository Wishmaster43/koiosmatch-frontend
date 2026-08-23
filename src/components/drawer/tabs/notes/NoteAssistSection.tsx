/**
 * NoteAssistSection — the Koios AI assist block under the note editor
 * (NOTE-ASSIST-1 F3, Danny 06-08 "geen vak voor de Koios AI verbeteringen"):
 * three actions (Verbeteren/Samenvatten/Actiepunten) over the note's current
 * text, a review-only suggestion box, and Overnemen/Verwerpen — mirrors the
 * vacancy-generation flow's knop→preview→toepassen/weggooien idiom (never
 * auto-overwrites, GenerateDescriptionFlow.tsx is the FE-mal). ALWAYS rendered
 * in the composer, even mid-error — Danny explicitly wants to SEE the Koios
 * space exist even when there is no budget left this month.
 *
 * K0-B (F4, 06-08): "Actiepunten" results now execute for REAL through the
 * SHARED `AssistActionsResultsPanel` (Uitvoeren → per-item execute/confirm
 * cards, "Als tekst toevoegen" kept as the old append-as-list secondary
 * option) — improve/summarize keep the original review→Overnemen/Verwerpen
 * idiom unchanged below. The header also carries the compact Wizard/Auto
 * switch (`NoteKoiosModeToggle`, same K0 setting as the profile "Weergave" tab).
 *
 * CMFE-KOIOS-CONSISTENCY-1 (Danny 09-08): the state machine (useNoteAssist),
 * the API call (assistNote) and the execute wizard
 * (AssistActionsResultsPanel/AssistActionItemCard/useAssistActionsExecute) are
 * now the SAME implementation the shared RichTextAssistBar uses on every other
 * rich-text field — this file's own noteAssistApi.ts/useNoteAssist.ts/
 * noteAssistApply.ts just re-export those names (§11 one source). What stays
 * genuinely NOTE-specific and lives only here: linking a batch of actions to
 * THIS note (`source={{ note_id: noteId }}`, the one field the shared execute
 * contract recognises today) and the K0 Wizard/Auto toggle in the header (a
 * note-popup placement decision, not a generic rich-text-field concern).
 *
 * DEFAULT-VALUE-1 (Danny 07-08, live popup feedback): the `common:notesAssist.*`
 * keys have since landed in all five shipped locale files — the Dutch
 * `defaultValue`s below are a harmless leftover safety net, never the value
 * actually shown once a real translation resolves.
 */
import { useTranslation } from 'react-i18next'
import { Wand2, AlignLeft, ListChecks, Check, X } from 'lucide-react'
import KoiosAiMark from '@/components/ui/KoiosAiMark'
import Spinner from '@/components/ui/Spinner'
import CalloutBox from '@/components/ui/CalloutBox'
import Button from '@/components/ui/Button'
import { useNoteAssist } from './useNoteAssist'
import { applyAssistResult, toPlainText } from './noteAssistApply'
import AssistActionsResultsPanel from '@/components/ui/richtext/AssistActionsResultsPanel'
import AssistTextPreview from '@/components/ui/richtext/AssistTextPreview'
import NoteKoiosModeToggle from './NoteKoiosModeToggle'
import { Caption, GroupLabel } from '@/components/ui/typography'
import { ACTION_TYPE_LABEL_NL } from './noteAssistApi'
import type { AssistMode, AssistActionType } from './noteAssistApi'

interface NoteAssistSectionProps {
  // The editor's CURRENT html body — the text the assist call runs over, and
  // the base that summarize/actions append onto (see noteAssistApply).
  body: string
  onApply: (nextBody: string) => void
  language?: string
  // Existing note being edited → its id, forwarded into the execute request's
  // `source.note_id`; a new unsaved note omits this (no source sent).
  noteId?: string
}

// Dutch fallback copy (DEFAULT-VALUE-1) — mode button label. The action-item
// type label (ACTION_TYPE_LABEL_NL) now lives in richTextAssistApi.ts (§11 one
// source — the shared AssistActionsResultsPanel/AssistActionItemCard render
// the same items).
const MODE_LABEL_NL: Record<AssistMode, string> = { improve: 'Verbeteren', summarize: 'Samenvatten', actions: 'Actiepunten' }

// One row per mode — icon + i18n key share the mode name, so adding a fourth
// mode later is one array entry, never a new hand-rolled button block.
const MODES: { mode: AssistMode; icon: typeof Wand2 }[] = [
  { mode: 'improve', icon: Wand2 },
  { mode: 'summarize', icon: AlignLeft },
  { mode: 'actions', icon: ListChecks },
]

export default function NoteAssistSection({ body, onApply, language, noteId }: NoteAssistSectionProps) {
  const { t } = useTranslation('common')
  const { mode, status, result, errorMessage, tone, run, discard } = useNoteAssist(language)
  const loading = status === 'loading'
  // Nothing to assist on yet — buttons stay VISIBLE but honestly disabled (§3: no
  // fake affordance) rather than hidden, so the section's footprint never jumps.
  // The moment the recruiter types ANYTHING, `hasText` flips and every button is
  // a real, enabled, wired click straight into `run` below — nothing further gates it.
  const hasText = body.replace(/<[^>]*>/g, '').trim().length > 0
  // Plain-text form of the note's CURRENT body, handed to AssistTextPreview
  // as `compareWith` so a rewritten reply can show an old-vs-new diff
  // (ASSIST-COMPARE-1) — reuses the same strip pattern as `hasText` above.
  const plainBody = toPlainText(body)

  // "Overnemen" — apply per-mode semantics (replace/append), then clear the
  // suggestion so a stale result can never be applied twice.
  const handleApply = () => {
    if (!result || !mode) return
    onApply(applyAssistResult(body, mode, result, (type) => t(`notesAssist.actionTypes.${type}`, { defaultValue: ACTION_TYPE_LABEL_NL[type as AssistActionType] ?? type })))
    discard()
  }

  // Als-tekst for ACTION results: apply without discarding, so Uitvoeren stays
  // available after the text lands (Danny 23-08).
  const handleApplyKeep = () => {
    if (!result || !mode) return
    onApply(applyAssistResult(body, mode, result, (type) => t(`notesAssist.actionTypes.${type}`, { defaultValue: ACTION_TYPE_LABEL_NL[type as AssistActionType] ?? type })))
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <KoiosAiMark size={15} />
        <GroupLabel>{t('notesAssist.title', { defaultValue: 'Koios AI' })}</GroupLabel>
        <div style={{ flex: 1 }} />
        {/* K0: the compact Wizard/Auto switch — "near the assist section" (same
            setting as the profile "Weergave" tab, see NoteKoiosModeToggle). */}
        <NoteKoiosModeToggle />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        {MODES.map(({ mode: m, icon: Icon }) => (
          <Button key={m} variant="soft" size="sm" onClick={() => run(m, body)} disabled={loading || !hasText}
            title={hasText ? undefined : t('notesAssist.needsText', { defaultValue: 'Schrijf eerst tekst in de notitie' })}>
            {loading && mode === m ? <Spinner size={12} /> : <Icon size={12} />}
            {t(`notesAssist.${m}`, { defaultValue: MODE_LABEL_NL[m] })}
          </Button>
        ))}
      </div>
      {/* Honest, VISIBLE reason the buttons are disabled — never rely on a
          hover-only title tooltip alone (Danny 07-08: "disabled... but then
          with the honest needsText hint, not silently"). */}
      {!hasText && (
        <Caption as="div" style={{ marginBottom: 8 }}>
          {t('notesAssist.needsText', { defaultValue: 'Schrijf eerst tekst in de notitie' })}
        </Caption>
      )}

      {/* Failure — the server's own pointable message (budget/unavailable read calm
          via the shared CalloutBox warning tone; a real error stays danger). The
          section itself never disappears, so the recruiter can retry right away. */}
      {status === 'error' && (
        <div style={{ marginBottom: 6, marginTop: hasText ? 4 : 0 }}>
          <CalloutBox variant={tone === 'warning' ? 'warning' : 'danger'}>{errorMessage}</CalloutBox>
        </div>
      )}

      {/* K0-B (F4): a non-empty 'actions' result hands off to the execute flow
          (Uitvoeren → real per-item execute/confirm cards) — the plain
          Overnemen/Verwerpen idiom below stays for improve/summarize/an EMPTY
          actions result (nothing to execute). Als-tekst KEEPS the items
          (Danny 23-08): appending the list must never take the Uitvoeren
          wizard away — Verwerpen is the exit. */}
      {status === 'success' && result && result.kind === 'actions' && result.items.length > 0 && (
        <AssistActionsResultsPanel items={result.items} source={noteId ? { note_id: noteId } : undefined} onApplyAsText={handleApplyKeep} onDiscard={discard} />
      )}

      {status === 'success' && result && !(result.kind === 'actions' && result.items.length > 0) && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', background: 'var(--bg)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* improve/summarize: readable prose preview (shared AssistTextPreview —
              renders TEXT only, never dangerouslySetInnerHTML, §7). */}
          {result.kind === 'text' ? (
            <AssistTextPreview text={result.text} compareWith={plainBody} />
          ) : (
            // actions with zero items — nothing to run, calm empty notice.
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('notesAssist.noItems', { defaultValue: 'Geen actiepunten gevonden' })}</div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            {/* No apply target when actions came back empty — nothing to overnemen. */}
            {result.kind === 'text' && (
              <Button variant="primary" size="sm" onClick={handleApply}><Check size={13} /> {t('notesAssist.apply', { defaultValue: 'Overnemen' })}</Button>
            )}
            <Button variant="secondary" size="sm" onClick={discard}><X size={13} /> {t('notesAssist.discard', { defaultValue: 'Verwerpen' })}</Button>
          </div>
        </div>
      )}
    </div>
  )
}
