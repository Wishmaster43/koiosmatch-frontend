/**
 * BackofficeLinkStatusIcons — K-250 K6: a subtle title-row indicator per
 * linked backoffice system (HelloFlex / Shiftmanager), so a recruiter sees
 * coupling health without opening the Links tab. Additive only (§3A frozen
 * candidate drawer: this is a NEW element, nothing existing changes). Icons
 * are non-interactive (title + aria-label carry the detail); clicking one
 * jumps to the Links tab, mirroring the changelog popover's "quick glance,
 * full detail is one click away" idiom.
 */
import { Link2, AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useApps } from '@/context/AppsContext'
import type { CandidateBackofficeLink } from '@/types/candidate'

interface BackofficeLinkStatusIconsProps {
  helloflexLink: CandidateBackofficeLink | null
  shiftmanagerLink: CandidateBackofficeLink | null
  onOpenIntegrations: () => void
}

// One icon per system: AlertTriangle (warning) for a failed sync, Link2 (muted) for a healthy link; unlinked/module-off renders nothing.
export default function BackofficeLinkStatusIcons({ helloflexLink, shiftmanagerLink, onOpenIntegrations }: BackofficeLinkStatusIconsProps) {
  const { t } = useTranslation('common')
  const apps = useApps()
  const isAppEnabled = apps?.isAppEnabled ?? (() => false)

  // Per-system rows, gated on the connector app being enabled (mirrors BackofficeLinksTab's own gate).
  const rows: { key: string; name: string; link: CandidateBackofficeLink | null; show: boolean }[] = [
    { key: 'helloflex', name: t('backofficeLinks.helloflex.name'), link: helloflexLink, show: isAppEnabled('hf') },
    { key: 'shiftmanager', name: t('backofficeLinks.shiftmanager.name'), link: shiftmanagerLink, show: isAppEnabled('shiftmanager') },
  ]

  return (
    <>
      {rows.map(row => {
        if (!row.show || !row.link || (row.link.status !== 'linked' && row.link.status !== 'failed')) return null
        const failed = row.link.status === 'failed'
        // A failed link without a captured reason gets its own sentence (never a dangling colon).
        const label = failed
          ? (row.link.lastError
              ? t('backofficeLinks.statusIcons.failed', { system: row.name, error: row.link.lastError })
              : t('backofficeLinks.statusIcons.failedNoReason', { system: row.name }))
          : t('backofficeLinks.statusIcons.linked', { system: row.name })
        return (
          <button key={row.key} type="button" onClick={onOpenIntegrations}
            title={label} aria-label={label}
            // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- frozen calm-header glyph control (Danny 08-08): mirrors the other bare 14px title-row icons in this drawer; Button iconOnly’s 28px chrome would change the frozen look
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: failed ? 'var(--color-warning-text)' : 'var(--text-muted)', opacity: failed ? 1 : 0.8 }}>
            {failed ? <AlertTriangle size={14} /> : <Link2 size={14} />}
          </button>
        )
      })}
    </>
  )
}
