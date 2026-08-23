/**
 * LogsPanel — dry-run honesty seam (K-111, Opus round golf-3a): the engine
 * settles a BLOCKED send step as `success` in steps[] and writes the honest
 * `skipped` only to the log rows (step_results[]), so on a dry-run the panel
 * must prefer step_results — the surface Proefdraaien actually opens must
 * never badge a not-sent WhatsApp green.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import api from '@/lib/api'
import LogsPanel from './LogsPanel'
import type { RunRow } from '@/types/reports'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn() } }
})
// Raw key passthrough — assertions target stable keys, not locale copy.
const activeI18n = vi.hoisted(() => ({ language: 'nl' }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: activeI18n }),
}))
vi.mock('@/i18n', () => ({ LOCALE_BY_LANG: { nl: 'nl-NL', en: 'en-GB' } }))
// The bundle-shape catalog is irrelevant to this seam — empty is honest.
vi.mock('./useModuleCatalog', () => ({ useModuleCatalog: () => ({ catalog: {} }) }))

// One finished run whose send step settled success in steps[] while the log
// rows carry the honest skipped — exactly what a dry-run produces.
const dryRun = {
  id: 'r1', status: 'success', dry_run: true, started_at: '2026-08-23T10:00:00Z', duration_ms: 900,
  steps: [{ label: 'WhatsApp versturen', status: 'success' }],
  step_results: [{ label: 'WhatsApp versturen', status: 'skipped' }],
} as unknown as RunRow

describe('LogsPanel — dry-run step preference', () => {
  beforeEach(() => { vi.mocked(api.get).mockReset(); vi.mocked(api.get).mockResolvedValue({ data: [] }) })

  it('shows the skipped log row, never the settled success badge, for a dry-run', async () => {
    render(<LogsPanel liveRun={dryRun} onClose={() => {}} />)
    // The live run auto-expands; its step must read skipped (from step_results).
    expect(await screen.findByText(/skipped/i)).toBeInTheDocument()
  })

  it('keeps preferring the enriched steps[] for a normal run', async () => {
    render(<LogsPanel liveRun={{ ...dryRun, dry_run: false } as unknown as RunRow} onClose={() => {}} />)
    expect(await screen.findAllByText(/success/i)).toBeTruthy()
    expect(screen.queryByText(/skipped/i)).toBeNull()
  })
})
