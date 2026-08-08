/**
 * PublicUrlsCard — this tenant's own public career-site + job-board feed URLs,
 * built from the MEASURED backend contract (routes/api/career.php): the site-info
 * endpoint is always reachable, while the vacancy list/detail, sitemap and Indeed/
 * Werkzoeken feed routes 404 until `career_site_active` is on (EnsureCareerSiteActive).
 * Gives the admin the real, copyable URLs to paste into a job board's feed config —
 * there is no separate career-site CMS to browse them from otherwise. Mirrors the
 * house copy-URL pattern (FacebookLeadsSettings/IncomingWebhooks.jsx), grouped in
 * the shared SectionCard (§3A/§11 reuse) instead of a hand-rolled bordered div.
 */
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import SectionCard from '@/components/ui/SectionCard'
import UrlRow from './UrlRow'
import { buildCareerSitePublicUrls } from './publicUrls'

// Same VITE_API_URL-derived base every other "copy this URL" settings screen
// uses (IncomingWebhooks.jsx, FacebookLeadsSettings.jsx) — the public career
// routes live under the same `/api` tree, so appending the route path verbatim
// reproduces the real, reachable URL.
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://koiosmatch-api.test/api'

interface PublicUrlsCardProps {
  /** Whether the tenant currently has the public career site switched on (career_site_active). */
  active: boolean
}

export default function PublicUrlsCard({ active }: PublicUrlsCardProps) {
  const { t } = useTranslation('settings')
  const auth = useAuth()
  const urls = buildCareerSitePublicUrls(auth?.activeTenant?.id, API_BASE)

  // No active tenant resolved yet (e.g. a super-admin who hasn't picked one) — an
  // honest empty state instead of URLs built on an "undefined" tenant segment (§3).
  if (urls.length === 0) {
    return (
      <SectionCard title={t('careerSite.urls.title')}>
        <p style={{ margin: 0, padding: '4px 0', fontSize: 12.5, color: 'var(--text-muted)' }}>
          {t('careerSite.urls.noTenant')}
        </p>
      </SectionCard>
    )
  }

  return (
    <SectionCard title={t('careerSite.urls.title')}>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 4px' }}>{t('careerSite.urls.subtitle')}</p>
      <div>
        {urls.map((u) => (
          <UrlRow key={u.id}
            label={t(`careerSite.urls.${u.id}`)}
            url={u.url}
            notice={u.gatedByActive && !active ? t('careerSite.urls.inactiveNotice') : undefined}
            disabledOpen={u.gatedByActive && !active}
            copyLabel={t('careerSite.urls.copy')}
            copiedLabel={t('common.copied')}
            openLabel={t('careerSite.urls.open')} />
        ))}
      </div>
    </SectionCard>
  )
}
