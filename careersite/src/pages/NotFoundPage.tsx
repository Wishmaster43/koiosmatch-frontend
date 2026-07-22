import { Link, useParams } from 'react-router-dom'
import { strings } from '../strings'

// Generic 404 — also reused by TenantLayout callers for an unknown vacancy reference.
export function NotFoundPage() {
  const { tenant } = useParams<{ tenant: string }>()
  return (
    <div className="page-notice">
      <h1>{strings.notFound.title}</h1>
      <p>{strings.notFound.body}</p>
      {tenant ? (
        <Link to={`/${tenant}/vacatures`} className="btn btn--secondary">
          {strings.notFound.backToList}
        </Link>
      ) : null}
    </div>
  )
}
