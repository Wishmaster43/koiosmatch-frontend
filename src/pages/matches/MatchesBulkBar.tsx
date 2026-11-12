/**
 * MatchesBulkBar — selection action bar shown above the table when ≥1 match is
 * checked. A match is read-only (§3B), so the only bulk operations are coupling
 * the selection to an external backoffice (HelloFlex / Shiftmanager). SYNC-BULK-1:
 * permission + module-availability are resolved INSIDE this component (mirrors
 * BackofficeLinksTab's own canLink/useApps checks) rather than via a passed prop —
 * the previous `canCouple` prop was wired to a `matches.couple` permission that
 * never existed in the backend (BackofficeEntityRegistry maps "match" to
 * matches.update, the SAME permission MatchDrawer's canLinkBackoffice already
 * checks), which silently hid this action for every role. A thin assembler over
 * the shared ActionMenu — extend by adding a node, never fork the bar.
 */
import { useTranslation } from 'react-i18next'
import { Link2, Building2, Layers } from 'lucide-react'
import type { MenuNode } from '@/components/ui/ActionMenu'
import BulkActionsBar from '@/components/ui/BulkActionsBar'
import { useAuth } from '@/context/AuthContext'
import { useApps } from '@/context/AppsContext'
import { bulkBarLabels } from '@/components/ui/bulk/bulkNodes'
import { Caption } from '@/components/ui/typography'

interface MatchesBulkBarProps {
  count: number
  onClear: () => void
  onCoupleHelloFlex: () => void
  onCoupleShiftmanager: () => void
}

// The matches bulk-action bar: backoffice coupling
// only, permission/module-gated inside this component (see the SYNC-BULK-1 note above).
export default function MatchesBulkBar({
  count, onClear, onCoupleHelloFlex, onCoupleShiftmanager,
}: MatchesBulkBarProps) {
  const { t } = useTranslation('matches')
  const auth = useAuth()
  const hasPermission = auth?.hasPermission ?? (() => false)
  const hasModule = auth?.hasModule ?? (() => false)
  const apps = useApps()
  const isAppEnabled = apps?.isAppEnabled ?? (() => false)
  const canCouple = hasPermission('matches.update')
  // The couple route is module-gated server-side, so the app flag alone would end in a 403.
  const showHelloflex = isAppEnabled('hf') && hasModule('hf')
  const showShiftmanager = isAppEnabled('shiftmanager')

  // Declarative bulk-action tree; coupling drills into whichever systems are
  // actually enabled for this tenant (never offer a switched-off system).
  const items: MenuNode[] = canCouple && (showHelloflex || showShiftmanager) ? [
    { key: 'couple', label: t('bulk.couple'), icon: Link2, items: [
      ...(showHelloflex ? [{ key: 'helloflex', label: t('bulk.target.helloflex'), icon: Building2, onSelect: onCoupleHelloFlex }] : []),
      ...(showShiftmanager ? [{ key: 'shiftmanager', label: t('bulk.target.shiftmanager'), icon: Layers, onSelect: onCoupleShiftmanager }] : []),
    ] },
  ] : []

  return (
    <BulkActionsBar
      onClear={onClear}
      items={items}
      labels={bulkBarLabels(t, count)}
    >
      {items.length === 0 && (
        // Two honest empty reasons: no permission at all, vs a permission but
        // no backoffice system enabled for this tenant.
        <Caption>{canCouple ? t('bulk.coupleUnavailable') : t('bulk.noPermission')}</Caption>
      )}
    </BulkActionsBar>
  )
}
