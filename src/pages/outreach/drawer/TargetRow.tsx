/**
 * TargetRow — one compact call-list row (checkbox, name, status chip, quick
 * actions, expand toggle) with its outcome chips, note and inline match prompt,
 * moved verbatim out of TargetsTab (SIZE-TRIGGER-1). Presentational: selection,
 * expand and match state live in the parent (useOutreachTargets).
 */
import { useTranslation } from 'react-i18next'
import { Phone, X, RotateCcw, ListChecks, Handshake, ChevronDown, ChevronRight } from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import CandidateStatusChip from '@/components/ui/CandidateStatusChip'
// G34: the house searchable dropdown replaces the native vacancy <select>.
import CreatableSelect from '@/components/ui/CreatableSelect'
import { initialsOf } from '@/lib/initials'
import { useDateFormat } from '@/lib/datetime'
import EntityLink from '@/components/ui/EntityLink'
import SoftChip from '@/components/ui/SoftChip'
import { Caption } from '@/components/ui/typography'
import Button from '@/components/ui/Button'
import QuickViewToggle from '@/components/ui/QuickViewToggle'
import type { useOutreachOutcomes } from '@/lib/useOutreachOutcomes'
import type { useOutreachStatuses } from '@/lib/useOutreachStatuses'
import type { VacancyOption } from '@/pages/candidates/shared'
import TargetNoteField from './TargetNoteField'
import { targetCandidateName } from './targetName'
import type { OutreachTarget } from '../hooks/useOutreachDetail'

type StatusLookup = ReturnType<typeof useOutreachStatuses>
type Outcomes = ReturnType<typeof useOutreachOutcomes>['outcomes']

// One call-list target row; every mutation arrives as a callback from the parent.
export default function TargetRow({ tg, statuses, metaOf, initial, outcomes, selectable, isSelected, onToggleRow,
  isExpanded, onToggleExpanded, onSetStatus, onSetOutcome, onSetNote, campaignId, onApplyTargetNote,
  onNewTask, onStartMatch, matchOpen, matchVacancyId, setMatchVacancyId, vacancyOptions, matchSaving,
  confirmMatch, onCancelMatch }: {
  tg: OutreachTarget
  statuses: StatusLookup['statuses']
  metaOf: StatusLookup['metaOf']
  initial: StatusLookup['initial']
  outcomes: Outcomes
  selectable: boolean
  isSelected: boolean
  onToggleRow: (id: string) => void
  isExpanded: boolean
  onToggleExpanded: (id: string) => void
  onSetStatus: (id: string, status: string) => void
  onSetOutcome: (id: string, outcome: string | null) => void
  onSetNote?: (id: string, note: string) => Promise<void>
  campaignId: string
  onApplyTargetNote?: (id: string, note: string) => void
  onNewTask: (tg: OutreachTarget) => void
  onStartMatch: (tg: OutreachTarget) => void
  matchOpen: boolean
  matchVacancyId: string
  setMatchVacancyId: (v: string) => void
  vacancyOptions: VacancyOption[]
  matchSaving: boolean
  confirmMatch: () => void
  onCancelMatch: () => void
}) {
  const { t } = useTranslation('outreach')
  const { formatDate } = useDateFormat()
  const st   = tg.status ?? initial?.value ?? 'todo'
  const meta = metaOf(st)
  const col  = meta?.color ?? 'var(--text-muted)'
  const handled = st !== (initial?.value ?? 'todo')
  return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 10px',
        border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {selectable && (
            <input type="checkbox" checked={isSelected} onChange={() => onToggleRow(tg.id)}
              style={{ cursor: 'pointer', accentColor: 'var(--color-primary)', flexShrink: 0 }} aria-label={t('common:selectRow')} />
          )}
          <Avatar initials={initialsOf(targetCandidateName(tg))} size={26} />
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Name → jump to the candidate drawer (cross-entity intent) via the shared
                EntityLink (renders plain text when there is no candidate id) + the
                deployability chip (C-CHIP) — it handles Lead→dash and lookup colours. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <EntityLink page="candidates" id={tg.candidate?.id} title={t('drawer.action.openCandidate')} tone="neutral" hideIcon>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{targetCandidateName(tg)}</span>
              </EntityLink>
              <span style={{ fontSize: 11, flexShrink: 0 }}>
                <CandidateStatusChip status={tg.candidate?.status} phase={tg.candidate?.phase} />
              </span>
            </div>
            {/* BELLIJST-SCALE-1 — contacted date + assignee on one muted line,
                so the row stays a single compact line, not a small card. */}
            {(tg.contacted_at || tg.assignee?.name) && (
              <Caption as="div" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {tg.contacted_at && formatDate(tg.contacted_at)}
                {tg.contacted_at && tg.assignee?.name && ' · '}
                {tg.assignee?.name && t('drawer.assign.assignedTo', { name: tg.assignee.name })}
              </Caption>
            )}
          </div>
          {/* Status chip — the shared SoftChip (was a hand-rolled 12/35 tint
              with raw ink, 2.2-3.5:1 — herhaal-slotaudit r3.5). */}
          <SoftChip round size={10} color={col}
            label={meta?.label ?? t(`drawer.target.${st}`, { defaultValue: st })} />
          {/* Quick check-off: contacted / answered / skipped; done rows can reset to todo. */}
          {/* Quick check-off / follow-up actions — Button iconOnly carries the chrome
              (§4 tint-vs-trio law: these are ACTIONS, not status/data chips); the
              per-action meaning stays on the icon glyph's own colour, never the
              button fill/border. variant="secondary" (not ghost): a borderless
              ghost button reads as invisible on this row's flat --bg card. */}
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            {!handled ? (
              <>
                {statuses.filter(o => o.value !== (initial?.value ?? 'todo')).map(o => (
                  <Button key={o.value} iconOnly size="sm" variant="secondary" title={o.label} aria-label={o.label}
                    onClick={() => onSetStatus(tg.id, o.value)}>
                    {o.is_reached
                      ? <Phone size={12} color={o.color ?? 'var(--color-primary)'} />
                      : <X size={12} color={o.color ?? 'var(--color-primary)'} />}
                  </Button>
                ))}
              </>
            ) : (
              <>
                <Button iconOnly size="sm" variant="secondary" title={t('drawer.action.newTask')} aria-label={t('drawer.action.newTask')}
                  onClick={() => onNewTask(tg)}>
                  <ListChecks size={12} color="var(--color-primary)" />
                </Button>
                <Button iconOnly size="sm" variant="secondary" title={t('drawer.action.makeMatch')} aria-label={t('drawer.action.makeMatch')}
                  onClick={() => onStartMatch(tg)}>
                  <Handshake size={12} color="var(--color-success)" />
                </Button>
                <Button iconOnly size="sm" variant="secondary" title={t('drawer.action.reset')} aria-label={t('drawer.action.reset')}
                  onClick={() => onSetStatus(tg.id, initial?.value ?? 'todo')}>
                  <RotateCcw size={12} color="var(--text-muted)" />
                </Button>
              </>
            )}
          </div>
          {/* BELLIJST-SCALE-1 — expand toggle: outcome chips + note stay tucked
              away so a long list reads as one line per candidate by default. */}
          {(handled || onSetNote) && (
            <Button variant="ghost" iconOnly onClick={() => onToggleExpanded(tg.id)} title={t('common:clickForDetails')}
              aria-label={t('common:clickForDetails')} aria-expanded={isExpanded}>
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </Button>
          )}
        </div>
  
        {/* Outcome chips — record HOW the call ended (lookup-driven; click again to
            clear). Clickable choices → the shared QuickViewToggle (§4), never a
            hand-rebuilt soft-chip recipe. */}
        {handled && isExpanded && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', paddingLeft: 36 }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t('drawer.outcomeLabel')}</span>
            {outcomes.map(o => {
              const active = tg.outcome === o.value
              return (
                <QuickViewToggle key={o.value} active={active} onToggle={() => onSetOutcome(tg.id, active ? null : o.value)}
                  label={o.label} color={o.color ?? 'var(--color-primary)'} size="compact" />
              )
            })}
          </div>
        )}
  
        {/* G30 — per-target note; hidden when the caller doesn't wire persistence
            (no fake affordance — §3), and tucked behind the same expand toggle. */}
        {onSetNote && isExpanded && (
          <div style={{ paddingLeft: 36 }}>
            <TargetNoteField note={tg.note} onSave={(note) => onSetNote(tg.id, note)}
              targetId={tg.id} campaignId={campaignId}
              onNoteSavedElsewhere={onApplyTargetNote ? (note) => onApplyTargetNote(tg.id, note) : undefined} />
          </div>
        )}
  
        {/* Inline match prompt for THIS row: pick a vacancy → POST /matches. */}
        {matchOpen && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 36 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <CreatableSelect value={matchVacancyId || null} onChange={setMatchVacancyId} allowCreate={false} clearable
                placeholder={t('drawer.matchPick')}
                options={vacancyOptions.map(v => ({ value: String(v.value), label: v.label + (v.client ? ` — ${v.client}` : '') }))}
                style={{ padding: '6px 8px', fontSize: 12 }} />
            </div>
            <Button variant="primary" size="sm" onClick={confirmMatch} disabled={!matchVacancyId || matchSaving}>
              {t('drawer.matchConfirm')}
            </Button>
            <Button variant="ghost" iconOnly onClick={onCancelMatch} title={t('common:cancel')} aria-label={t('common:cancel')}>
              <X size={14} />
            </Button>
          </div>
        )}
      </div>
  )
}
