// One shared multi-file download path (candidates + customers document lists).
export interface DownloadableFile { url?: string | null; name?: string | null }

// Trigger a single browser download via a transient, off-DOM anchor element.
function triggerDownload(file: DownloadableFile): void {
  const a = document.createElement('a')
  a.href = file.url as string
  a.download = file.name ?? ''
  a.rel = 'noopener noreferrer'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

// Small awaitable delay so consecutive downloads don't fire in the same tick.
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

/**
 * Download every file that has a url, one at a time with a short delay between
 * them (never after the last). Browsers gate several near-simultaneous
 * downloads behind a one-time "allow multiple downloads" prompt (Chrome) —
 * staggering them keeps each click registering as its own user-triggered
 * download. Entries without a url are skipped. Returns how many downloads were
 * started. No file names or PII are logged.
 */
export async function downloadFilesSequentially(files: DownloadableFile[], delayMs = 300): Promise<number> {
  const downloadable = files.filter(f => f.url)
  for (let i = 0; i < downloadable.length; i++) {
    triggerDownload(downloadable[i])
    if (i < downloadable.length - 1) await sleep(delayMs)
  }
  return downloadable.length
}
