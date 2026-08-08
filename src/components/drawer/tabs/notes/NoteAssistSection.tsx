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
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Wand2, AlignLeft, ListChecks, Loader2, Check, X } from 'lucide-react'
import KoiosAiMark from '@/components/ui/KoiosAiMark'
import CalloutBox from '@/components/ui/CalloutBox'
import { useNoteAssist } from './useNoteAssist'
import { applyAssistResult } from './noteAssistApply'
import AssistActionsResultsPanel from '@/components/ui/richtext/AssistActionsResultsPanel'
import NoteKoiosModeToggle from './NoteKoiosModeToggle'
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

const actionBtn = (active: boolean, disabled: boolean): CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 500,
  padding: '5px 9px', borderRadius: 7, cursor: disabled ? 'default' : 'pointer',
  background: 'var(--color-primary-bg)', color: 'var(--color-primary-text)',
  border: '1px solid color-mix(in srgb, var(--color-primary) 30%, transparent)',
  opacity: disabled && !active ? 0.5 : 1,
})
const primaryBtn: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
  padding: '5px 11px', borderRadius: 7, cursor: 'pointer', background: 'var(--color-primary)', color: 'var(--color-on-accent)', border: 'none' }
const ghostBtn: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500,
  padding: '5px 11px', borderRadius: 7, cursor: 'pointer', background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)' }

// Dutch fallback copy (DEFAULT-VALUE-1) — mode button label. The action-item
// type label (ACTION_TYPE_LABEL_NL) now lives in noteAssistApi.ts (§11 one
// source — NoteActionsResultsPanel/NoteActionItemCard render the same items).
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

  // "Overnemen" — apply per-mode semantics (replace/append), then clear the
  // suggestion so a stale result can never be applied twice.
  const handleApply = () => {
    if (!result || !mode) return
    onApply(applyAssistResult(body, mode, result, (type) => t(`notesAssist.actionTypes.${type}`, { defaultValue: ACTION_TYPE_LABEL_NL[type as AssistActionType] ?? type })))
    discard()
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <KoiosAiMark size={15} />
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
          {t('notesAssist.title', { defaultValue: 'Koios AI' })}
        </span>
        <div style={{ flex: 1 }} />
        {/* K0: the compact Wizard/Auto switch — "near the assist section" (same
            setting as the profile "Weergave" tab, see NoteKoiosModeToggle). */}
        <NoteKoiosModeToggle />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        {MODES.map(({ mode: m, icon: Icon }) => (
          <button key={m} type="button" onClick={() => run(m, body)} disabled={loading || !hasText}
            title={hasText ? undefined : t('notesAssist.needsText', { defaultValue: 'Schrijf eerst tekst in de notitie' })}
            style={actionBtn(loading && mode === m, loading || !hasText)}>
            {loading && mode === m ? <Loader2 size={12} className="animate-spin" /> : <Icon size={12} />}
            {t(`notesAssist.${m}`, { defaultValue: MODE_LABEL_NL[m] })}
          </button>
        ))}
      </div>
      {/* Honest, VISIBLE reason the buttons are disabled — never rely on a
          hover-only title tooltip alone (Danny 07-08: "disabled... but then
          with the honest needsText hint, not silently"). */}
      {!hasText && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
          {t('notesAssist.needsText', { defaultValue: 'Schrijf eerst tekst in de notitie' })}
        </div>
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
          actions result (nothing to execute). */}
      {status === 'success' && result && result.kind === 'actions' && result.items.length > 0 && (
        <AssistActionsResultsPanel items={result.items} source={noteId ? { note_id: noteId } : undefined} onApplyAsText={handleApply} onDiscard={discard} />
      )}

      {status === 'success' && result && !(result.kind === 'actions' && result.items.length > 0) && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', background: 'var(--bg)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* improve/summarize: plain prose preview (never dangerouslySetInnerHTML — the
              model's reply is rendered as TEXT content, §7, same as GenerateDescriptionFlow). */}
          {result.kind === 'text' ? (
            <div style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: 'var(--text)', lineHeight: 1.5, maxHeight: 180, overflow: 'auto' }}>{result.text}</div>
          ) : (
            // actions with zero items — nothing to run, calm empty notice.
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('notesAssist.noItems', { defaultValue: 'Geen actiepunten gevonden' })}</div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            {/* No apply target when actions came back empty — nothing to overnemen. */}
            {result.kind === 'text' && (
              <button type="button" onClick={handleApply} style={primaryBtn}><Check size={13} /> {t('notesAssist.apply', { defaultValue: 'Overnemen' })}</button>
            )}
            <button type="button" onClick={discard} style={ghostBtn}><X size={13} /> {t('notesAssist.discard', { defaultValue: 'Verwerpen' })}</button>
          </div>
        </div>
      )}
    </div>
  )
}
