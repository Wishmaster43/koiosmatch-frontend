import { useEffect, useState } from 'react'
import { Outlet, useParams } from 'react-router-dom'
import { fetchSite } from './api'
import type { SiteInfo } from './types'
import { Header } from './components/Header'
import { strings } from './strings'

type ThemeStatus = 'loading' | 'error' | 'success'

const FALLBACK_BRAND_COLOR = '#2f6f4f'

// Fetches the tenant's public branding and applies it as a CSS variable, so every
// component down the tree can read `var(--brand)` without prop-drilling the color.
function useSiteTheme(tenant: string | undefined) {
  const [site, setSite] = useState<SiteInfo | null>(null)
  const [status, setStatus] = useState<ThemeStatus>('loading')

  useEffect(() => {
    if (!tenant) {
      setStatus('error')
      return
    }
    // Guards against a slow request resolving after the tenant param changed again.
    let alive = true
    setStatus('loading')
    fetchSite(tenant)
      .then((data) => {
        if (!alive) return
        setSite(data)
        document.documentElement.style.setProperty('--brand', data.brand_color ?? FALLBACK_BRAND_COLOR)
        setStatus('success')
      })
      .catch(() => {
        if (!alive) return
        document.documentElement.style.setProperty('--brand', FALLBACK_BRAND_COLOR)
        setStatus('error')
      })
    return () => {
      alive = false
    }
  }, [tenant])

  return { site, status }
}

// Tenant-scoped layout: applies the brand theme, renders the branded header, and
// hands off to the matched child route (vacancy list / detail). A tenant whose
// `/site` lookup fails still gets a calm notice instead of a broken header.
export function TenantLayout() {
  const { tenant } = useParams<{ tenant: string }>()
  const { site, status } = useSiteTheme(tenant)

  if (status === 'error') {
    return (
      <div className="page-notice" role="alert">
        <h1>{strings.home.title}</h1>
        <p>{strings.home.body}</p>
      </div>
    )
  }

  return (
    <>
      <Header site={site} loading={status === 'loading'} tenant={tenant ?? ''} />
      <main className="page-main">
        <Outlet />
      </main>
    </>
  )
}
