/**
 * triggerBlobDownload — save an already-fetched Blob to disk via a throwaway
 * object-URL anchor. The caller does the real GET through the shared axios
 * client (cookie/CSRF already attached); this only triggers the browser's save
 * dialog. Extracted so every export screen shares one download trigger (DRY —
 * ExportSettings and AdminInvoicesSettings both hand-rolled this).
 */
export function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
