/**
 * buildWaWebQueueFilterGroups — the right-panel filter for the WA-Web queue
 * tab (K-193 fase 1): a single status radio group, mirroring the pattern in
 * waMessageFilterGroups.ts. Registered only while the tab is active (the page
 * unregisters it on tab switch/unmount), so it never shows on the other tabs.
 */
import type { TFunction } from 'i18next'

const STATUSES = ['queued', 'sending', 'sent', 'failed', 'paused', 'canceled'] as const

export function buildWaWebQueueFilterGroups({ t, status, setStatus }: {
  t: TFunction
  status: string
  setStatus: (v: string) => void
}) {
  const options = STATUSES.map(v => ({ value: v, label: t(`waWebQueue.status.${v}`, { defaultValue: v }) }))
  return [
    {
      key: 'wa-web-status', type: 'radio', category: t('filters.categories.message'),
      label: t('waWebQueue.filterStatus'), selected: status ? [status] : [], options,
      onToggle: (v: string) => setStatus(status === v ? '' : v),
    },
  ]
}
