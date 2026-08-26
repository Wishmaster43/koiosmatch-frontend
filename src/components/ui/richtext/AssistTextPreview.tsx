/**
 * AssistTextPreview — the ONE readable preview for a Koios assist text result
 * (ASSIST-LEESBAAR-1, Danny 23-08: "Als het een lange tekst is, is dit niet
 * leesbaar zo" — "if it's a long text, this isn't readable like this").
 * Renders the model's reply as plain TEXT (never
 * dangerouslySetInnerHTML — the reply is untrusted, §7) in body typography
 * with real paragraph spacing, collapsed to a calm height; a long reply gets
 * an explicit expand/collapse toggle instead of an endless tiny scroll well.
 * Shared by the note composer, the rich-text assist bar and the conversation
 * assist (§11 — one source, three call sites).
 *
 * ASSIST-COMPARE-1 (Danny 23-08: "oude en nieuwe tekst kan je nu niet goed
 * vergelijken" — "you can't properly compare the old and new text right now"):
 * an optional `compareWith` (the field's CURRENT plain text)
 * adds a small New/Compare SegmentedControl above the text. Compare renders
 * the word-level diff (textDiff.ts) as plain text spans — never HTML —
 * added = success-tint + underline, removed = danger-tint + line-through,
 * each carrying a visually-hidden label so colour is never the only signal
 * (§6). Falls back to New-only when compareWith is absent, identical, or
 * over the diff util's performance guard (returns null).
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronUp } from 'lucide-react'
import Button from '@/components/ui/Button'
import { BodyText } from '@/components/ui/typography'
import SegmentedControl from '@/components/ui/SegmentedControl'
import { tintBg } from '@/lib/tint'
import { diffWords, type DiffSegment } from './textDiff'

// Deterministic "long reply" threshold for showing the toggle — jsdom (and a
// first paint) has no reliable layout to measure, so length decides.
const LONG_CHARS = 700
const LONG_BREAKS = 6

// One diff segment, rendered as plain text with a tint + text-decoration and
// a visually-hidden label — colour/strikethrough is never the only signal.
function DiffSpan({ segment }: { segment: DiffSegment }) {
  const { t } = useTranslation('common')
  if (segment.type === 'same') return <>{segment.text} </>
  const isAdded = segment.type === 'added'
  const color = isAdded ? 'var(--color-success)' : 'var(--color-danger)'
  return (
    <span style={{
      background: tintBg(color),
      textDecoration: isAdded ? 'underline' : 'line-through',
      textDecorationColor: color,
    }}>
      <span className="sr-only">
        {isAdded ? t('notesAssist.diffAdded') : t('notesAssist.diffRemoved')}
      </span>
      {segment.text}{' '}
    </span>
  )
}

// The shared readable Koios assist result preview with an optional expand toggle and New/Compare view.
export default function AssistTextPreview({ text, compareWith }: { text: string; compareWith?: string }) {
  const { t } = useTranslation('common')
  const [expanded, setExpanded] = useState(false)
  const [view, setView] = useState<'new' | 'compare'>('new')
  // Toggle only for genuinely long replies; short ones render whole, no chrome.
  const isLong = text.length > LONG_CHARS || (text.match(/\n/g)?.length ?? 0) > LONG_BREAKS

  // Diff only computed when a comparison text is actually offered — the
  // performance guard (textDiff.ts) returns null above 2500 words/side, in
  // which case the Compare view never renders (no O(n*m) explosion).
  const diff = useMemo(
    () => (compareWith !== undefined ? diffWords(compareWith, text) : null),
    [compareWith, text],
  )
  const canCompare = compareWith !== undefined && diff !== null && diff.some(seg => seg.type !== 'same')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {canCompare && (
        <SegmentedControl
          size="compact"
          ariaLabel={t('notesAssist.viewLabel')}
          value={view}
          onChange={v => setView(v as 'new' | 'compare')}
          options={[
            { value: 'new', label: t('notesAssist.viewNew') },
            { value: 'compare', label: t('notesAssist.viewCompare') },
          ]}
        />
      )}
      {/* Blank lines become real paragraph spacing — prose, not a text dump. */}
      <div style={{ maxHeight: isLong && !expanded ? 300 : undefined, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {canCompare && view === 'compare' ? (
          <BodyText style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
            {diff!.map((seg, i) => <DiffSpan key={i} segment={seg} />)}
          </BodyText>
        ) : (
          text.split(/\n{2,}/).map((para, i) => (
            <BodyText key={i} style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{para}</BodyText>
          ))
        )}
      </div>
      {isLong && (
        <Button variant="ghost" size="sm" onClick={() => setExpanded(v => !v)} style={{ alignSelf: 'flex-start' }}>
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          {expanded ? t('notesAssist.showLess') : t('notesAssist.showAll')}
        </Button>
      )}
    </div>
  )
}
