import { useState, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { VacancyLookupsProvider } from '@/context/VacancyLookupsContext'
import DetailsTab from '@/pages/vacancies/drawer/DetailsTab'
import { mapVacancyDetail } from '@/pages/vacancies/data/mapVacancy'
import type { ApplicationDetail } from '@/types/application'
import type { VacancyDetail } from '@/types/vacancy'

type LoadState = 'loading' | 'error' | 'empty' | 'ok'

/**
 * VacancyTab — reuses the real vacancy detail inside the application drawer:
 * fetches the linked vacancy and renders the shared vacancy DetailsTab (read-only),
 * so it looks identical to the vacancy drawer instead of a bespoke banner.
 */
export default function VacancyTab({ application: a }: { application: ApplicationDetail }) {
  const { t } = useTranslation('applications')
  const [vac, setVac] = useState<VacancyDetail | null>(null)
  const [state, setState] = useState<LoadState>('loading')

  // Fetch the full vacancy detail for the drawer; four UI states handled below.
  useEffect(() => {
    const id = a.vacancyId
    if (id == null) { setState('empty'); return }
    let alive = true
    setState('loading')
    api.get(`/vacancies/${id}`)
      .then(r => { if (!alive) return; setVac(mapVacancyDetail(r.data?.data ?? r.data)); setState('ok') })
      .catch(() => { if (alive) setState('error') })
    return () => { alive = false }
  }, [a.vacancyId])

  const muted: CSSProperties = { fontSize: 13, color: 'var(--text-muted)', padding: '24px 0', textAlign: 'center' }
  if (state === 'loading') return <div style={muted}>{t('vacancyDetail.loading')}</div>
  if (state === 'error') return <div style={muted}>{t('vacancyDetail.error')}</div>
  if (state === 'empty' || !vac) return <div style={muted}>{t('vacancyDetail.empty')}</div>

  // Read-only reuse: DetailsTab needs the vacancy lookups it renders labels from.
  return (
    <VacancyLookupsProvider>
      <DetailsTab vacancy={vac} />
    </VacancyLookupsProvider>
  )
}
