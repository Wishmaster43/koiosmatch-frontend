import { useEffect } from 'react'

const APP_NAME = 'KoiosMatch'

// useDocumentTitle: sets "<title> · KoiosMatch" while mounted and restores the previous title on unmount (WCAG 2.4.2).
export function useDocumentTitle(title: string | null): void {
  useEffect(() => {
    if (!title) return
    const previous = document.title
    document.title = `${title} · ${APP_NAME}`
    return () => { document.title = previous }
  }, [title])
}
