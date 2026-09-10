/**
 * vacancyStatusAndActionColumns — the status/applications/pencil columns
 * shared verbatim by ScopedVacanciesTab and VacanciesTab (DRY round 11,
 * CUSTTABS2). The title column differs (tone) and stays per file.
 */
import { Pencil } from 'lucide-react'
import type { TFunction } from 'i18next'
import StatusPill from '@/components/ui/StatusPill'
import { Mono } from '@/components/ui/typography'
import Button from '@/components/ui/Button'
import type { Column } from '@/components/ui/DataTable'
import type { VacancyRow } from '../hooks/useCustomerDrawerData'
import type { Id } from '@/types/common'

// Navigation callback shape both callers get from useNavigation().openEntity.
type OpenEntity = (page: string, id?: Id | null, tab?: string) => void

// Returns the shared status/applications/pencil columns; the caller's own
// title column goes first, before spreading these.
export function vacancyStatusAndActionColumns(t: TFunction, { openEntity, canEditVacancies }: {
  openEntity: OpenEntity
  canEditVacancies: boolean
}): Column<VacancyRow>[] {
  return [
    // eslint-disable-next-line no-restricted-syntax -- DATA fallback, not a UI colour choice
    { key: 'status', header: t('vacancies.col.status'), render: v => <StatusPill label={v.status.label} color={v.status.color || '#9CA3AF'} /> },
    // K7c/S-custcount-1: ghost-button deep link to this vacancy's own Sollicitaties
    // (applicants) tab — same visual/intent as VacanciesTable.tsx's own applications
    // count column (its leadsBtn idiom), routed cross-page via openEntity's optional
    // tab argument.
    { key: 'applications', header: t('vacancies.col.applications'), align: 'right', sortable: true, sortValue: v => v.applications,
      render: v => (
        <Button variant="ghost" size="sm" aria-label={t('vacancies.col.applicationsOpen')}
          onClick={e => { e.stopPropagation(); openEntity('vacancies', v.id, 'applicants') }}
          style={{ padding: 0, height: 'auto' }}>
          <Mono style={{ fontSize: 12 }}>{v.applications}</Mono>
        </Button>
      ) },
    // K7b: row pencil opening the vacancy's own drawer for editing — mirrors
    // CustomerApplicationsList's pencil action cluster (its edit lives in a modal;
    // a vacancy's fields edit in-place inside its own drawer, so the pencil opens
    // that drawer rather than a second, non-existent edit modal — no fake affordance).
    ...(canEditVacancies ? [{
      key: 'actions', header: '', align: 'right' as const,
      render: (v: VacancyRow) => (
        <Button variant="ghost" size="sm" iconOnly onClick={e => { e.stopPropagation(); openEntity('vacancies', v.id) }}
          title={t('vacancies.editVacancy')} aria-label={t('vacancies.editVacancy')}>
          <Pencil size={12} />
        </Button>
      ),
    }] : []),
  ]
}
