import { strings } from '../strings'

// Root path with no tenant in the URL — this site is always accessed via a
// tenant-scoped link (e.g. /acme/vacatures), so `/` alone just explains that.
export function HomePage() {
  return (
    <div className="page-notice">
      <h1>{strings.home.title}</h1>
      <p>{strings.home.body}</p>
    </div>
  )
}
