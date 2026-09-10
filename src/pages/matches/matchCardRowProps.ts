/**
 * matchCardRowProps — the shared MatchCard prop bag for a read-only Matches
 * tab row, byte-identical between the customer and vacancy MatchesTab (DRY
 * round 11, CUSTTABS2). Each caller spreads this and adds its own tail prop
 * (contractStatus / contractForm / showVacancyColumn) at the JSX call site —
 * the shared bag never picks one copy's tail over the other (rule B). The
 * candidate drawer's own MatchesTab carries additional props (onBeforeOpen,
 * onEdit, vacancyUrl, helloflexGuid) and a different otherPartyLabel source,
 * so it is not a third consumer here.
 */
import type { ReactNode } from 'react'
import type { MatchCardProps } from './MatchCard'
import type { MatchRow } from '@/types/match'

type MatchCardCommonProps = Pick<MatchCardProps,
  | 'id' | 'vacancyId' | 'vacancyTitle' | 'stageLabel' | 'stageColor' | 'score'
  | 'helloflexLink' | 'shiftmanagerLink' | 'showHelloflex' | 'showShiftmanager'
  | 'otherPartyLabel' | 'otherParty' | 'contractType' | 'functionTitle' | 'branchName'
  | 'ownerName' | 'startDate' | 'endDate' | 'isClosed' | 'archived'
  | 'collapsible' | 'flatRow' | 'leadWithOtherParty'>

// The status-lookup shape both callers already resolve via useMatchStatuses().metaOf.
interface MatchStatusMeta { label?: string | null; color?: string | null; is_closed?: boolean }

// Builds the common MatchCard props for one match row — see file doc for the tail props each caller still adds.
export function matchCardRowProps(m: MatchRow, { statusMeta, showHelloflex, showShiftmanager, otherPartyLabel }: {
  statusMeta: MatchStatusMeta | undefined
  showHelloflex: boolean
  showShiftmanager: boolean
  otherPartyLabel: ReactNode
}): MatchCardCommonProps {
  return {
    id: m.id, vacancyId: m.vacancyId, vacancyTitle: m.vacancy || '—',
    stageLabel: statusMeta?.label ?? m.stage, stageColor: statusMeta?.color ?? m.stageColor,
    score: m.score,
    helloflexLink: m.helloflexLink, shiftmanagerLink: m.shiftmanagerLink,
    showHelloflex, showShiftmanager,
    otherPartyLabel,
    otherParty: { page: 'candidates', id: m.candidateId ?? null, label: m.candidate || '' },
    contractType: m.contractType,
    functionTitle: m.functionTitle, branchName: m.branchName, ownerName: m.owner,
    startDate: m.startDate, endDate: m.endDate,
    isClosed: statusMeta?.is_closed, archived: m.archived,
    collapsible: true, flatRow: true, leadWithOtherParty: true,
  }
}
