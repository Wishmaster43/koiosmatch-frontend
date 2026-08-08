import { useApps } from '@/context/AppsContext'

/**
 * useBackofficeLinksVisible (DD-FE-6, "no empty tabs" — §3A) — true when the
 * shared "Koppelingen" tab (BackofficeLinksTab) has real content for the
 * current tenant: at least one of HelloFlex/Shiftmanager is an enabled
 * connector app. Mirrors BackofficeLinksTab's own internal isAppEnabled('hf'/
 * 'shiftmanager') gate, extracted so an entity drawer can decide whether to
 * LIST the tab at all before mounting it — a tab whose body renders nothing
 * (no cards, no "Koppelen" button) must not appear in the tab bar. Entities
 * that always pass extra children into BackofficeLinksTab (e.g. a PDOK card,
 * see CustomerDrawer/LocationDetail/VacancyDrawer) never need this check —
 * their tab body is never empty regardless of the connector apps.
 */
export function useBackofficeLinksVisible(): boolean {
  const apps = useApps()
  const isAppEnabled = apps?.isAppEnabled ?? (() => false)
  return isAppEnabled('hf') || isAppEnabled('shiftmanager')
}
