import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useVacancy } from '../hooks/useVacancy'
import { SafeHtml } from '../components/SafeHtml'
import { ApplyForm } from '../components/ApplyForm'
import { getApplicationSettings } from '../lib/applySettings'
import { toJsonLdString } from '../lib/jsonLd'
import { formatHours, formatSalary } from '../lib/format'
import { strings } from '../strings'

const META_DESCRIPTION_LENGTH = 160

// Detail + apply page container: fetches one vacancy, keeps document.title/meta
// description in sync for SEO, and renders the Google Jobs JSON-LD alongside the
// human-readable detail and the inline application form.
export function VacancyDetailPage() {
  const { tenant, ref } = useParams<{ tenant: string; ref: string }>()
  const { status, vacancy } = useVacancy(tenant, ref)

  // SEO: swap in the vacancy's title/description while shown, restore the page
  // default on unmount so navigating away never leaves a stale tab title behind.
  useEffect(() => {
    if (!vacancy) return
    const previousTitle = document.title
    const metaDescriptionEl = document.querySelector('meta[name="description"]')
    const previousDescription = metaDescriptionEl?.getAttribute('content') ?? ''
    document.title = `${vacancy.title} — ${vacancy.city}`
    metaDescriptionEl?.setAttribute('content', vacancy.intro.slice(0, META_DESCRIPTION_LENGTH))
    return () => {
      document.title = previousTitle
      metaDescriptionEl?.setAttribute('content', previousDescription)
    }
  }, [vacancy])

  if (status === 'loading') {
    return <p className="state-notice" role="status">{strings.detail.loading}</p>
  }

  if (status === 'error' || !vacancy) {
    return (
      <div className="state-notice" role="alert">
        <p>{strings.detail.notFound}</p>
        <Link to={`/${tenant}/vacatures`} className="btn btn--secondary">
          {strings.detail.back}
        </Link>
      </div>
    )
  }

  return (
    <article className="vacancy-detail">
      <Link to={`/${tenant}/vacatures`} className="back-link">{strings.detail.back}</Link>
      <h1>{vacancy.title}</h1>
      <ul className="vacancy-detail__meta">
        <li>{vacancy.city} · {vacancy.province}</li>
        <li>{formatHours(vacancy.hours)}</li>
        <li>{vacancy.contract_types.join(', ')}</li>
        <li>{formatSalary(vacancy.salary)}</li>
        {vacancy.employment_type ? <li>{vacancy.employment_type}</li> : null}
        {vacancy.remote_allowed ? <li>{strings.detail.remoteAllowed}</li> : null}
      </ul>

      <SafeHtml html={vacancy.description} className="vacancy-detail__description" />

      {/* Google Jobs structured data — plain JSX text child, see lib/jsonLd.ts for why this is safe. */}
      <script type="application/ld+json">{toJsonLdString(vacancy.json_ld)}</script>

      <section className="vacancy-detail__apply" id="solliciteren">
        <ApplyForm
          tenant={tenant ?? ''}
          reference={vacancy.reference_number}
          applicationSettings={getApplicationSettings(vacancy)}
        />
      </section>
    </article>
  )
}
