import DOMPurify from 'dompurify'
import { useMemo } from 'react'

interface SafeHtmlProps {
  html: string
  className?: string
}

// The ONE place in this app that uses dangerouslySetInnerHTML (CLAUDE.md §7: forbidden
// by default, allowed only when sanitized with a written reason). The backend already
// sanitizes `description`, but this is public, unauthenticated, user-triggered content
// (a job description a tenant admin wrote) — sanitizing again client-side is a cheap
// defense-in-depth layer against a compromised or future-changed backend response.
export function SafeHtml({ html, className }: SafeHtmlProps) {
  const clean = useMemo(() => DOMPurify.sanitize(html), [html])
  return <div className={className} dangerouslySetInnerHTML={{ __html: clean }} />
}
