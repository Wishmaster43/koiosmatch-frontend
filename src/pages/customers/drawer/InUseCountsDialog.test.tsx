/**
 * InUseCountsDialog — regression test for the D9 tint finding: the "Archiveer"
 * escape button must use the shared lib/tint helpers (§4), not an ad-hoc
 * color-mix percentage pair (40%/10%) that matches neither house tint level.
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import InUseCountsDialog from './InUseCountsDialog'
import { tintBg, tintBorder, chipInk } from '@/lib/tint'
import '@/i18n'

describe('InUseCountsDialog', () => {
  it('renders the Archiveer button with the shared §4 tint, not an ad-hoc color-mix pair', () => {
    render(
      <InUseCountsDialog open counts={{ vacancies: 2 }} onClose={() => {}} onArchive={() => {}} />
    )
    const archiveBtn = screen.getByRole('button', { name: /archiveren/i })
    expect(archiveBtn.style.background).toBe(tintBg('var(--color-archive)'))
    expect(archiveBtn.style.border).toBe(tintBorder('var(--color-archive)'))
    expect(archiveBtn.style.color).toBe(chipInk('var(--color-archive)'))
  })

  it('fires onArchive when clicked', async () => {
    const onArchive = vi.fn()
    render(
      <InUseCountsDialog open counts={{ vacancies: 2 }} onClose={() => {}} onArchive={onArchive} />
    )
    const archiveBtn = screen.getByRole('button', { name: /archiveren/i })
    archiveBtn.click()
    expect(onArchive).toHaveBeenCalledTimes(1)
  })

  it('shows no archive action when onArchive is not wired', () => {
    render(<InUseCountsDialog open counts={{ vacancies: 2 }} onClose={() => {}} />)
    expect(screen.queryByRole('button', { name: /archiveren/i })).toBeNull()
  })
})
