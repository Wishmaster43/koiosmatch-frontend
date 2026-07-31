import { useTranslation } from 'react-i18next'
import { ListChecks, Link2, Building2, Layers, X } from 'lucide-react'
import ActionMenu from '@/components/ui/ActionMenu'
import type { MenuNode } from '@/components/ui/ActionMenu'
import { BTN_H } from '@/config/buttonMetrics'
import { useAuth } from '@/context/AuthContext'
import { useApps } from '@/context/AppsContext'

interface MatchesBulkBarProps {
  count: number
  onClear: () => void
  onCoupleHelloFlex: () => void
  onCoupleShiftmanager: () => void
}

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
export default function MatchesBulkBar({
  count, onClear, onCoupleHelloFlex, onCoupleShiftmanager,
}: MatchesBulkBarProps) {
  const { t } = useTranslation('matches')
  const auth = useAuth()
  const hasPermission = auth?.hasPermission ?? (() => false)
  const apps = useApps()
  const isAppEnabled = apps?.isAppEnabled ?? (() => false)
  const canCouple = hasPermission('matches.update')
  const showHelloflex = isAppEnabled('hf')
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%',
      padding: '8px 12px', borderRadius: 8, background: 'var(--color-primary-bg)', border: '1px solid var(--color-primary)' }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-primary)' }}>{t('bulk.selected', { count })}</span>

      {items.length > 0
        ? <ActionMenu label={t('bulk.actions')} icon={ListChecks} items={items} />
        // Two honest empty reasons: no permission at all, vs a permission but
        // no backoffice system enabled for this tenant.
        : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{canCouple ? t('bulk.coupleUnavailable') : t('bulk.noPermission')}</span>}

      {/* BTN_H (§4/§9): one explicit height for every text/action button, everywhere. */}
      <button onClick={onClear}
        style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 'auto', height: BTN_H, padding: '0 10px', fontSize: 12,
          border: 'none', borderRadius: 7, background: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 500 }}>
        <X size={13} /> {t('bulk.deselect')}
      </button>
    </div>
  )
}
