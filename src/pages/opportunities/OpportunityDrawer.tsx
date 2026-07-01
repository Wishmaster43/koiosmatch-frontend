import { useTranslation } from 'react-i18next'
import EntityDrawer from '@/components/drawer/EntityDrawer'
import EntityHeader from '@/components/drawer/EntityHeader'
import { useDateFormat } from '@/lib/datetime'
import DetailsTab from './drawer/DetailsTab'
import type { Opportunity } from '@/types/opportunity'
import type { Id, LookupOption } from '@/types/common'

interface DrawerUser { id: Id; name: string }
interface DrawerCustomer { id: Id; name: string }
type UpdateFn = (id: Id | undefined, patch: Record<string, unknown>) => void

interface OpportunityDrawerProps {
  opportunity: Opportunity | null
  onClose: () => void
  expanded?: boolean
  onToggleExpand?: () => void
  onUpdate?: UpdateFn
  stages?: LookupOption[]
  users?: DrawerUser[]
  customers?: DrawerCustomer[]
}

/**
 * OpportunityDrawer — thin container (mirror VacancyDrawer/CandidateDrawer): wires
 * data (lookups + onUpdate) and declares the header config + tab list. No business
 * logic. Stage/owner/customer edit through the header pickers; onUpdate(id, patch)
 * uses UI keys (stageValue/ownerId/clientId) that the page maps to API keys.
 */
export default function OpportunityDrawer({
  opportunity: o, onClose, expanded, onToggleExpand, onUpdate, stages = [], users = [], customers = [],
}: OpportunityDrawerProps) {
  const { t } = useTranslation('opportunities')
  const { formatDate } = useDateFormat()

  if (!o) return null

  // Owner picker — include the current owner so it shows even if not in `users`.
  const ownerOptions = [
    ...(users.some(u => u.id === o.ownerId) || !o.owner ? [] : [{ value: o.ownerId, label: o.owner }]),
    ...users.map(u => ({ value: u.id, label: u.name })),
  ]
  const clientOptions = customers.map(c => ({ value: c.id, label: c.name }))
  const stageOptions = stages.map(s => ({ value: s.value, label: s.label }))

  const tabs = [
    { id: 'details', label: t('drawer.tabs.details'), render: () => <DetailsTab opportunity={o} /> },
  ]

  return (
    <EntityDrawer
      entity={o}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
      footer={<span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('drawer.createdAt', { date: formatDate(o.date) || '—' })}</span>}
      tabs={tabs}
      header={() => (
        <EntityHeader
          label={t('drawer.entityLabel')}
          expanded={expanded} onToggleExpand={onToggleExpand} onClose={onClose}
          avatar={{ initials: o.initials, soft: true }}
          title={o.title}
          subtitle={o.client || '—'}
          meta={[
            { key: 'stage', label: t('drawer.stage'), value: o.stageValue,
              options: stageOptions, placeholder: t('drawer.selectStage'),
              onChange: val => onUpdate?.(o.id, { stageValue: val }), menuWidth: 180, width: 170 },
            { key: 'owner', label: t('drawer.owner'), value: o.ownerId,
              options: ownerOptions, placeholder: t('drawer.selectOwner'),
              onChange: val => onUpdate?.(o.id, { ownerId: val }), menuWidth: 200, width: 180 },
            { key: 'client', label: t('drawer.client'), value: o.clientId,
              options: clientOptions, placeholder: t('drawer.selectClient'),
              onChange: val => onUpdate?.(o.id, { clientId: val }), menuWidth: 220, width: 200 },
          ]}
        />
      )}
    />
  )
}
