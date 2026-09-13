// Shared "selected search result" summary card — the identical wrapper chrome,
// header row (title/subtitle + pager/close + action) and score/AI-advice blocks
// used by both pages/candidates/drawer/VacancySearchSummaryCard.tsx (candidate
// drawer, FROZEN screen) and pages/vacancies/drawer/CandidateSearchTab.tsx (the
// vacancy drawer's inline card). Differences travel in as slots/props: title,
// subtitle, chips, an entity-only `extra` block, an entity-only `description`
// paragraph and the conditional apply action (DRY round 11, SEARCHTABS).
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import DrillPager from './DrillPager'
import Button from '@/components/ui/Button'
import KoiosAiMark from '@/components/ui/KoiosAiMark'
import MatchScoreBlock from '@/components/match/MatchScoreBlock'
import type { Criterion } from '@/components/match/MatchScoreBlock'
import { Caption, SectionTitle } from '@/components/ui/typography'

// Thin shell component: renders the shared chrome and slots in caller-provided nodes.
export default function SearchSummaryCardFrame({
  title, subtitle, index, total, onPrev, onNext, onClose, closeLabel, action,
  chips, extra, description, score, criteria, aiAdviceReason, aiAdvisedLabel,
}: {
  // Header: title is the EntityLink (page differs per entity), subtitle the
  // joined meta line — both resolved nodes, never raw strings the frame formats.
  title: ReactNode
  subtitle: ReactNode
  // Pager + close: identical anatomy, only the total/handlers differ per caller.
  index: number
  total: number
  onPrev: (() => void) | undefined
  onNext: (() => void) | undefined
  onClose: () => void
  closeLabel: string
  // Primary action slot (the "Solliciteren" DrawerAddButton) — a caller that
  // gates it on a permission passes null/undefined, rendering nothing.
  action?: ReactNode
  // Chip row content — distance/status/employmentType/hours differ per entity.
  chips: ReactNode
  // Vacancy-only detail block (salary/experience/education/seniority) — absent
  // on the candidate side, so this slot renders nothing there.
  extra?: ReactNode
  // Vacancy-only description paragraph — absent on the candidate side.
  description?: ReactNode
  // Read-only LIVE score (CMBE MATCH-EXPLORER-1 fase 2+3) — no onSave, so
  // MatchScoreBlock renders without its edit/adjust controls.
  score: number | null
  criteria: Criterion[]
  // AI-advice line — the label arrives already resolved (rule C: no i18n key here).
  aiAdviceReason: string | null
  aiAdvisedLabel: string
}) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          {/* The title IS the link (Danny 23-07): orange name opens in-app, trailing icon a new tab. */}
          <SectionTitle as="div">{title}</SectionTitle>
          {/* HUISSTIJL-1: identical 11/400/var(--text-muted) render as a div. */}
          <Caption as="div">{subtitle}</Caption>
        </div>
        {/* Right column (Danny 13-08 screenshot): pager+close on top, the apply
            action beneath — the title row keeps its full width so a long name
            never truncates against it. */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <DrillPager index={index} total={total} onPrev={onPrev} onNext={onNext} />
            <Button variant="ghost" iconOnly size="sm" onClick={onClose} aria-label={closeLabel}>
              <X size={14} />
            </Button>
          </div>
          {action}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {chips}
      </div>
      {extra}
      {description}
      {score != null && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          <MatchScoreBlock score={score} criteria={criteria} />
        </div>
      )}
      {aiAdviceReason && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-muted)' }}>
          <KoiosAiMark size={16} title={aiAdvisedLabel} />
          <span>{aiAdviceReason}</span>
        </div>
      )}
    </div>
  )
}
