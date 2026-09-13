import { useEffect } from 'react'

/**
 * usePopoutWindowTitle — sets the OS window title for a second-screen popout
 * while its record is loaded, restoring the previous title on unmount so a
 * reused/closed window slot never keeps a stale title. Shared by every popout
 * branch (candidate/application/customer/generic notes, the notes-list
 * popouts, …) that used to repeat this exact effect (DRY round, CANDTABS
 * package) — `record` gates the effect (no record yet = no title change),
 * `title` is the caller's own already-translated string.
 */
export function usePopoutWindowTitle(record: unknown, title: string): void {
  useEffect(() => {
    if (!record) return
    const previous = document.title
    document.title = title
    return () => { document.title = previous }
  }, [record, title])
}
