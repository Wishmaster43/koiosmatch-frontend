/**
 * SettingsChangelogButton — THE one shared changelog affordance for the settings
 * scaffold (CHANGELOG-OVERAL-1, item 3): rendered once in SettingsPage's content
 * header so every settings screen carries it, never hand-rolled per section. Wraps
 * the shared ChangelogPopover + EntityChangelog, filtered to the active screen's
 * audit-log table.
 *
 * logName (CHANGELOG-OVERAL-1) — the backend audit-log table name:
 *  — undefined (default): use 'settings' (the key/value tenant settings table)
 *  — 'tablename': query GET /activity-log?log_name='tablename' for a lookup table
 *  — null: render disabled button with noTrailYet tooltip (table not yet audited)
 */
import { useTranslation } from 'react-i18next'
import ChangelogPopover from '@/components/drawer/ChangelogPopover'
import EntityChangelog from '@/components/drawer/EntityChangelog'
import Button from '@/components/ui/Button'
import { History } from 'lucide-react'

export default function SettingsChangelogButton({ logName = 'settings' }: { logName?: string | null }) {
  const { t } = useTranslation('settings')

  // logName: null means the section edits a table with no audit trail yet
  // (e.g., opportunity_lookups edits five tables, or a table in fixround F).
  if (logName === null) {
    return (
      <Button variant="ghost" size="sm" iconOnly disabled
        aria-label={t('changelog.noTrailYet')} title={t('changelog.noTrailYet')}>
        <History size={16} />
      </Button>
    )
  }

  return (
    <ChangelogPopover label={t('audit.title')}>
      <EntityChangelog logName={logName} />
    </ChangelogPopover>
  )
}
