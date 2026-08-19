import { useRef } from 'react'
import type { DragEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useDateFormat } from '@/lib/datetime'
import { CheckCircle2 } from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import EntityLink from '@/components/ui/EntityLink'
import KoiosAiMark from '@/components/ui/KoiosAiMark'
// HUISSTIJL-1: shared typography atoms — the column header (13/600) and the
// card's muted date line (11/muted) are exact matches for the house scale.
import { SectionTitle, Caption } from '@/components/ui/typography'
import type { Application } from '@/types/application'
import type { Id } from '@/types/common'
import { useDragAutoScroll } from '@/lib/useDragAutoScroll'

export interface BoardPhase { key: string; label: string; color: string }

// Score as soft-coloured text (green ≥75, amber ≥50, red below).
const scoreColor = (v: number): string => (v >= 75 ? 'var(--color-success)' : v >= 50 ? 'var(--color-warning)' : 'var(--color-danger)')

// A single draggable application card.
function BoardCard({ app, onDragStart, onClick, selected }: {
  app: Application; onDragStart: (e: DragEvent<HTMLDivElement>, id: Id | undefined) => void; onClick: (app: Application) => void; selected: boolean
}) {
  const { formatDate } = useDateFormat()
  // AI-Act disclosure hint (AI-ACT-1) for the AI-task mark, plus the applications
  // namespace for the placed-badge label (PLACED-1).
  const { t } = useTranslation(['common', 'applications'])
  return (
    <div draggable onDragStart={e => onDragStart(e, app.id)} onClick={() => onClick(app)}
      style={{ background: 'var(--surface)', borderRadius: 10, padding: '12px 14px', marginBottom: 8,
        cursor: 'grab', userSelect: 'none',
        border: `1px solid ${selected ? 'var(--color-primary)' : 'var(--border)'}` }}>

      {/* Header: avatar + name + new-dot */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Avatar initials={app.candidateInitials} size={28} />
        {/* S-board-2: the board card is the last surface still rendering these as
            plain text — every other application surface links them (see
            CustomerApplicationsList's own candidate cell). hideIcon: the compact
            card has no room for the "open in new tab" trailing icon. */}
        <span style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: 13 }}>
          <EntityLink page="candidates" id={app.candidateId} tone="neutral" hideIcon>{app.candidateName}</EntityLink>
        </span>
        {/* PLACED-1: subtle placed badge — colour never the only signal, the icon
            shape + aria/title text carry the meaning on their own. */}
        {app.hasMatch && (
          <CheckCircle2 size={14} strokeWidth={2} color="var(--color-success)" style={{ flexShrink: 0 }}
            aria-label={t('applications:buckets.placed')} role="img" />
        )}
        <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          background: app.isNew ? 'var(--color-danger)' : 'var(--border)' }} />
      </div>

      {/* Match score */}
      {app.score != null && (
        <div style={{ marginBottom: 6, fontSize: 12, fontWeight: 600, color: scoreColor(app.score) }}>{app.score}%</div>
      )}

      {/* Vacancy (2-line clamp) — S-board-2: linked, same reasoning as the candidate name above. */}
      <div style={{ fontSize: 11, lineHeight: 1.4, marginBottom: 6,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        <EntityLink page="vacancies" id={app.vacancyId} tone="neutral" hideIcon>{app.vacancyTitle}</EntityLink>
      </div>

      {/* AI task — the mark alone is icon-only; the surrounding "AI task" label already
          exists as a code comment but not as user-facing text, so the mark carries the
          AI-Act disclosure hint (AI-ACT-1) as its tooltip rather than a second stacked
          label in this already-compact card. */}
      {app.task && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, background: 'var(--color-primary-bg)',
          borderRadius: 6, padding: '5px 8px', marginBottom: 8 }}>
          <KoiosAiMark size={16} title={t('aiGeneratedHint', { defaultValue: 'Door Koios AI gegenereerd — controleer voor gebruik.' })} />
          <span style={{ fontSize: 11, color: 'var(--color-primary-text)', fontWeight: 500,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {app.task}
          </span>
        </div>
      )}

      {/* Footer: owner + date (raw ISO from the API → locale format, Danny 2026-07-13) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Avatar initials={app.owner?.initials} size={18} color={app.owner?.color} />
        <Caption>{formatDate(app.created)}</Caption>
      </div>
    </div>
  )
}

// A single phase column with its cards.
function BoardColumn({ phase, items, onDragStart, onDrop, onDragOver, onSelect, selectedId }: {
  phase: BoardPhase; items: Application[]
  onDragStart: (e: DragEvent<HTMLDivElement>, id: Id | undefined) => void
  onDrop: (e: DragEvent<HTMLDivElement>, phaseKey: string) => void
  onDragOver: (e: DragEvent<HTMLDivElement>) => void
  onSelect: (app: Application) => void
  selectedId?: Id | null
}) {
  return (
    <div style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column' }}
      onDrop={e => onDrop(e, phase.key)} onDragOver={onDragOver}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <SectionTitle as="span">{phase.label}</SectionTitle>
        {/* F7 (audit R1): color-mix instead of a hex-concat tint (`color + '20'`
            silently breaks once `phase.color` is a `var(--…)` token, not a hex —
            color-mix works for both). */}
        <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 99,
          background: `color-mix(in srgb, ${phase.color} 12%, transparent)`, color: phase.color }}>{items.length}</span>
      </div>
      <div style={{ flex: 1, minHeight: 60 }}>
        {items.map(app => (
          <BoardCard key={app.id} app={app} onDragStart={onDragStart}
            onClick={onSelect} selected={app.id === selectedId} />
        ))}
      </div>
    </div>
  )
}

/**
 * ApplicationsBoard — kanban view, one column per funnel phase. Presentational:
 * the page owns the data and the phase mutation (onMove).
 */
export default function ApplicationsBoard({ rows, phases, onMove, onSelect, selectedId, loading, error }: {
  rows: Application[]; phases: BoardPhase[]; onMove: (id: Id, phaseKey: string) => void; onSelect: (app: Application) => void; selectedId?: Id | null
  // F3 (audit R1): the board renders off the wide (bucket-less) sample — surface
  // its own loading/error state instead of silently showing zero-count columns
  // on first paint or after a failed fetch (mirrors ApplicationsTable's states).
  loading?: boolean; error?: unknown
}) {
  const { t } = useTranslation('applications')
  // Edge-scroll the board while dragging (HTML5 DnD never scrolls itself).
  const { ref: boardScrollRef, onDragOver: boardAutoScroll } = useDragAutoScroll<HTMLDivElement>()
  const dragId = useRef<Id | null>(null)

  const handleDragStart = (e: DragEvent<HTMLDivElement>, id: Id | undefined) => { dragId.current = id ?? null; e.dataTransfer.effectAllowed = 'move' }
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }
  const handleDrop = (e: DragEvent<HTMLDivElement>, phaseKey: string) => {
    e.preventDefault()
    if (dragId.current != null) { onMove(dragId.current, phaseKey); dragId.current = null }
  }

  // Honest four-state board (F3): a wide-sample fetch failure or the first-paint
  // load must never look like "zero applications everywhere" — show the same
  // calm, centred message the table shows in its own loading/error/empty slot,
  // instead of silently rendering every phase column at count 0.
  if (loading || error || rows.length === 0) {
    const message = loading ? t('loading') : error ? t('error') : t('empty')
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 40, fontSize: 13, color: 'var(--text-muted)' }}>
        {message}
      </div>
    )
  }

  return (
    <div ref={boardScrollRef} onDragOver={boardAutoScroll} style={{ flex: 1, overflow: 'auto', padding: '0 24px 20px' }}>
      <div style={{ display: 'flex', gap: 16, minWidth: 'max-content', paddingBottom: 8 }}>
        {phases.map(phase => (
          <BoardColumn key={phase.key} phase={phase}
            items={rows.filter(r => r.phaseKey === phase.key)}
            onDragStart={handleDragStart} onDrop={handleDrop} onDragOver={handleDragOver}
            onSelect={onSelect} selectedId={selectedId} />
        ))}
      </div>
    </div>
  )
}
