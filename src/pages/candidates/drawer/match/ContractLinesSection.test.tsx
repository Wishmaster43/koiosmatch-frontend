/**
 * ContractLinesSection — the contract-line rate input must take its mono
 * typography from the shared `monoStyle` atom (components/ui/typography),
 * never a hand-typed 'JetBrains Mono, monospace' font stack (HUISSTIJL-1).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ContractLinesSection from './ContractLinesSection'
import type { MatchContractLine } from '@/types/match'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))
// CreatableSelect pulls in its own lookup/menu machinery irrelevant here —
// stand in with a plain marker so the row renders without those hooks.
vi.mock('@/components/ui/CreatableSelect', () => ({
  default: () => <div data-testid="function-select" />,
}))

const t = ((k: string) => k) as unknown as import('i18next').TFunction

describe('ContractLinesSection', () => {
  it('renders the rate input with the shared Mono typography atom, not a hardcoded font-family', () => {
    const lines: MatchContractLine[] = [{ functionTitle: 'Verpleegkundige', rate: '25.50' }]
    render(<ContractLinesSection t={t} lines={lines} setLines={vi.fn()} functions={[]} />)
    const rateInput = screen.getByPlaceholderText('placement.contractLines.rate') as HTMLInputElement
    // JSDOM normalises the quoted family name — assert the family, not the raw string.
    expect(rateInput.style.fontFamily).toContain('JetBrains Mono')
  })
})
