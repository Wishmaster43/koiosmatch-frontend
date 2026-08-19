/**
 * RichTextAssistBar — the ONE toolbar add-on that gives EVERY free-text field
 * in the app dictation + Koios AI (Danny 08-08: "alle omschrijvingen moeten
 * ook een mic functionaliteit hebben en Koios AI"). It plugs into
 * RichTextEditor's toolbar and owns two affordances:
 *
 *  1. MIC — the shared `KoiosVoiceButton`, driven by the editor's OWN language
 *     picker, appending each recognised sentence through the shared
 *     `appendDictatedText`. Identical behaviour to the note composer's mic
 *     (hold-open session the user switches off, escaped append, honest
 *     unsupported/insecure gates) because it IS that same component + helper —
 *     not a second copy.
 *  2. KOIOS ASSIST — Verbeteren / Samenvatten / Actiepunten, ALWAYS visible in
 *     their own row under the toolbar (never behind a click-to-expand icon), a
 *     review-only preview, and Overnemen/Verwerpen. Never auto-applies, never
 *     overwrites silently. Mirrors NoteAssistSection's shape and tone 1:1 —
 *     the two now share their state machine (`useRichTextAssist`), their API
 *     call (`assistRichText`) and, for 'actions', the SAME execute wizard
 *     (`AssistActionsResultsPanel`) — notes/ no longer keeps its own copy of
 *     any of the three (§11 one source).
 *
 * CMFE-KOIOS-CONSISTENCY-1 (Danny 09-08, verbatim: "Waarom heb je bij nieuwe
 * taak de icon Koios en staan de knoppen er niet gelijk? Actiepunten auto en
 * wizard ontbreekt!!") — this file used to hide Verbeteren/Samenvatten behind
 * a click on the Koios mark AND lack the Actiepunten mode entirely, both
 * inconsistent with the note composer. Fixed: the mode row is always in view,
 * honestly disabled with a visible reason while the field is empty — same as
 * notes (§3: a disabled-with-reason button is honest, a hidden one is not) —
 * and 'actions' is a first-class third mode with the same execute wizard.
 *
 * ACTIONS-SCOPE-DEFAULT-FLIP (Danny 09-08, verbatim: "Actiepunten volgen uit
 * een GESPREK, niet uit een omschrijving. De meerderheid van de velden zijn
 * omschrijvingen, dus de standaard hoort andersom"): the default `modes` below
 * is improve+summarize ONLY — Actiepunten no longer ships on a field unless the
 * caller explicitly opts in with `modes={['improve', 'summarize', 'actions']}`.
 * Before this, every new free-text field got Actiepunten unasked, and each
 * conversation-vs-description call had to be un-set per field (profile text,
 * match text, opportunity text, vacancy description, five settings screens all
 * carried the same `assistModes={['improve', 'summarize']}` override on the
 * SAME day this shipped — that repetition is exactly the smell that flipped the
 * default instead). The only place Actiepunten stays ON by default is
 * NoteAssistSection (the note composer's own richer assist block below the
 * editor, not this bar) — the one field that genuinely is a conversation.
 *
 * KNOWN FOOTPRINT CHANGE: this rides on ~30 editors app-wide, several of them
 * on the candidate/customer drill-downs a 2026-08-08 memory note freezes
 * ("niets wijzigen zonder overleg, uitsluiten in brede sweeps"). The assist
 * row now always takes its own line under those toolbars too, exactly as
 * everywhere else — the whole point of ONE shared bar (§4) is one look on
 * every field, never a per-screen exemption. Flagged in the delivery report
 * for confirmation rather than silently special-cased.
 *
 * KOIOS-GENERATE-1 (Danny 09-08): a FOURTH, opt-in affordance — "Genereer met
 * Koios" (mirrors the vacancy description's own generate button, same label
 * wording + soft-tint pill shape). It POSTs entity+id (not the field's text) to
 * /ai/koios/generate and lands in the exact same review-then-Overnemen preview
 * as the other three modes — see richTextAssistApi.ts's header for the measured
 * contract. Only rendered when the caller passes `generate={{ entity, id }}`:
 * an omitted prop means the backend cannot generate for that field, so the
 * button must not exist there at all (§3, no fake affordance) — this is WHY it
 * is its own prop rather than a fifth `modes` entry (`modes` alone can never
 * carry the entity/id a real request needs).
 *
 * i18n: every label reuses the ALREADY-SHIPPED `common:notesAssist.*` keys
 * (present in nl/en/de/fr/es); this component adds exactly one new key,
 * `notesAssist.generate`, reported alongside the delivery (§5 — locale files
 * are never edited directly here).
 *
 * LAZY EXECUTE WIZARD: AssistActionsResultsPanel is loaded via `lazy()`, not a
 * static import. It (through AssistActionItemCard) pulls in `@/lib/datetime`,
 * which eagerly initialises the real i18next singleton as an IMPORT-TIME side
 * effect — harmless in the running app, but a static import here would drag
 * that init into every one of the ~30 screens that mount this bar (most of
 * which never trigger 'actions'), which broke unrelated component tests that
 * assume a mocked/un-initialised i18n (measured while building this change:
 * MatchTextBlock.test.tsx started failing on unrelated title-text lookups).
 * `lazy()` defers the import until an 'actions' result with items actually
 * renders it — the one case that already needs the real wizard.
 */
import { lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { Wand2, AlignLeft, ListChecks, Sparkles, Loader2, Check, X } from 'lucide-react'
import KoiosAiMark from './KoiosAiMark'
import CalloutBox from './CalloutBox'
import Button from './Button'
import KoiosVoiceButton from '@/components/layout/koios/KoiosVoiceButton'
import { useRichTextAssist } from './richtext/useRichTextAssist'
import { appendDictatedText, applyRichTextAssist, hasPlainText } from './richtext/richTextAssistApply'
import type { GenerateEntity, RichTextAssistMode } from './richtext/richTextAssistApi'

// See the LAZY EXECUTE WIZARD docblock note above for why this is lazy, not a
// plain static import.
const AssistActionsResultsPanel = lazy(() => import('./richtext/AssistActionsResultsPanel'))

interface RichTextAssistBarProps {
  // The field's CURRENT html — what dictation appends to and what assist runs over.
  value: string
  onChange: (html: string) => void
  // Dictation + spellcheck language (2-letter code) — the editor's own picker.
  language?: string
  // Which assist modes to offer. DEFAULT (prop omitted) is improve+summarize
  // ONLY — see ACTIONS-SCOPE-DEFAULT-FLIP below, most fields are descriptions,
  // not conversations. Pass `['improve', 'summarize', 'actions']` explicitly for
  // a conversation-like field (a note, +Match's Opmerkingen). An EMPTY array
  // renders the mic alone — used by the note composer, whose richer assist
  // section (with the K0 Wizard/Auto toggle) already owns this exact same mode
  // set below the editor.
  modes?: RichTextAssistMode[]
  // KOIOS-GENERATE-1: which entity/id to generate a fresh suggestion FROM. Omit
  // entirely on a field the backend cannot generate for — see the file header.
  generate?: { entity: GenerateEntity; id: string }
}

// One row per mode — icon + i18n key share the mode name, so a fourth mode is
// one array entry, never a new hand-rolled button block. Mirrors
// NoteAssistSection's MODES array 1:1 (§11 one shared shape).
const MODES: { mode: RichTextAssistMode; icon: typeof Wand2 }[] = [
  { mode: 'improve', icon: Wand2 },
  { mode: 'summarize', icon: AlignLeft },
  { mode: 'actions', icon: ListChecks },
]


export default function RichTextAssistBar({ value, onChange, language, modes = ['improve', 'summarize'], generate }: RichTextAssistBarProps) {
  const { t } = useTranslation('common')
  const { mode, status, result, errorMessage, tone, run, runGenerate, discard } = useRichTextAssist(language)
  const hasModes = modes.length > 0
  // The group renders once EITHER a text mode or generate is offered — a field
  // with modes=[] but a `generate` prop (a hypothetical future empty-field-only
  // host) must still get its own row, not silently disappear.
  const offersAssist = hasModes || Boolean(generate)
  const loading = status === 'loading'
  const hasText = hasPlainText(value)
  const assistLabel = t('notesAssist.title')

  // Append one recognised dictation chunk — escaped, continuing the last
  // paragraph, never replacing what the user already wrote.
  const appendVoiceText = (chunk: string) => onChange(appendDictatedText(value, chunk))

  // "Overnemen" — apply per-mode semantics (replace/append), then clear the
  // suggestion so a stale result can never be applied twice.
  const handleApply = () => {
    if (!mode || !result) return
    onChange(applyRichTextAssist(value, mode, result, (type) => t(`notesAssist.actionTypes.${type}`)))
    discard()
  }

  return (
    <>
      {/* Dictation — hidden entirely on an unsupported browser, disabled with an
          honest tooltip over plain http; both inherited from the shared button. */}
      <KoiosVoiceButton onText={appendVoiceText} lang={language} t={t} tone="primary" />

      {/* Koios assist — its own row under the toolbar, ALWAYS in view once any
          mode is offered (no click-to-expand, mirrors NoteAssistSection 1:1). */}
      {offersAssist && (
        <div role="group" aria-label={assistLabel} data-testid="rte-assist-panel"
          style={{ flexBasis: '100%', width: '100%', marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border)',
            // `order` puts the strip visually LAST in the wrapping toolbar (below
            // the language/HTML/expand controls) while DOM order keeps it right
            // after the mic — always its own line, never collapsed.
            order: 99, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <KoiosAiMark size={14} />
            <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
              {assistLabel}
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
            {/* HUISSTIJL-1: the house Button (variant="soft") — solid tenant trio,
                same as every other accent action button app-wide. */}
            {MODES.filter(m => modes.includes(m.mode)).map(({ mode: m, icon: Icon }) => (
              <Button key={m} variant="soft" onClick={() => run(m, value)} disabled={loading || !hasText}
                data-testid={`rte-assist-${m}`}
                title={hasText ? undefined : t('notesAssist.needsText')}>
                {loading && mode === m ? <Loader2 size={12} className="animate-spin" /> : <Icon size={12} />}
                {t(`notesAssist.${m}`)}
              </Button>
            ))}
            {/* KOIOS-GENERATE-1: unlike the modes above, this never needs existing
                text — it writes FROM the entity's own data, so only `loading` gates it. */}
            {generate && (
              <Button variant="soft" onClick={() => runGenerate(generate.entity, generate.id)} disabled={loading}
                data-testid="rte-assist-generate">
                {loading && mode === 'generate' ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {t('notesAssist.generate')}
              </Button>
            )}
          </div>

          {/* Honest, VISIBLE reason the buttons are disabled — never a
              hover-only tooltip alone (§3). Only applies to the text modes:
              generate needs no existing text, so it stays out of this gate. */}
          {!hasText && hasModes && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('notesAssist.needsText')}</div>
          )}

          {/* Failure — the server's own pointable message; budget/unconfigured
              read calm (warning), a real failure stays danger. */}
          {status === 'error' && (
            <CalloutBox variant={tone === 'warning' ? 'warning' : 'danger'}>{errorMessage}</CalloutBox>
          )}

          {/* A non-empty 'actions' result hands off to the shared execute wizard
              (Uitvoeren → real per-item execute/confirm cards) — the plain
              Overnemen/Verwerpen idiom below stays for improve/summarize/an
              EMPTY actions result (nothing to execute). No `source` passed: a
              generic field has no note to link the run to (mirrors a new,
              unsaved note — an already-proven no-linkage path). */}
          {status === 'success' && result && result.kind === 'actions' && result.items.length > 0 && (
            <Suspense fallback={null}>
              <AssistActionsResultsPanel items={result.items} onApplyAsText={handleApply} onDiscard={discard} />
            </Suspense>
          )}

          {status === 'success' && result && !(result.kind === 'actions' && result.items.length > 0) && (
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', background: 'var(--bg)',
              display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Plain-prose preview — rendered as TEXT, never
                  dangerouslySetInnerHTML (§7); the model's reply is untrusted. */}
              {result.kind === 'text' ? (
                <div data-testid="rte-assist-preview"
                  style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: 'var(--text)', lineHeight: 1.5, maxHeight: 180, overflow: 'auto' }}>{result.text}</div>
              ) : (
                // actions with zero items — nothing to run, calm empty notice.
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('notesAssist.noItems')}</div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                {/* No apply target when actions came back empty — nothing to overnemen. */}
                {result.kind === 'text' && (
                  <Button variant="primary" onClick={handleApply} data-testid="rte-assist-apply">
                    <Check size={13} /> {t('notesAssist.apply')}
                  </Button>
                )}
                <Button variant="secondary" onClick={discard} data-testid="rte-assist-discard">
                  <X size={13} /> {t('notesAssist.discard')}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}
