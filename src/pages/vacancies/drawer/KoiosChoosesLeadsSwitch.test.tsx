/** KoiosChoosesLeadsSwitch · LEADS-AI-1: hidden without the key, request through onUpdate, disabled without it. */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import i18n from '@/i18n'
import KoiosChoosesLeadsSwitch from './KoiosChoosesLeadsSwitch'
import type { VacancyDetail } from '@/types/vacancy'

const vac = (koiosChoosesLeads?: boolean) => ({ id: 'v1', koiosChoosesLeads }) as unknown as VacancyDetail
const label = () => i18n.t('vacancies:candidateSearch.koiosChoosesLeads')

describe('KoiosChoosesLeadsSwitch', () => {
  it('renders no switch while the key is undefined', () => {
    render(<KoiosChoosesLeadsSwitch vacancy={vac(undefined)} onUpdate={vi.fn()} />)
    expect(screen.queryByRole('switch')).toBeNull()
  })

  it('renders an unchecked named switch linked to its help caption', () => {
    render(<KoiosChoosesLeadsSwitch vacancy={vac(false)} onUpdate={vi.fn()} />)
    const sw = screen.getByRole('switch', { name: label() })
    expect(sw.getAttribute('aria-checked')).toBe('false')
    const help = document.getElementById(sw.getAttribute('aria-describedby') as string)
    expect(help?.textContent).toBe(i18n.t('vacancies:candidateSearch.koiosChoosesLeadsHelp'))
  })

  it('calls onUpdate once with the flipped value', () => {
    const onUpdate = vi.fn().mockResolvedValue(true)
    render(<KoiosChoosesLeadsSwitch vacancy={vac(false)} onUpdate={onUpdate} />)
    fireEvent.click(screen.getByRole('switch'))
    expect(onUpdate).toHaveBeenCalledTimes(1)
    expect(onUpdate).toHaveBeenCalledWith('v1', { koiosChoosesLeads: true })
  })

  it('is disabled while saving and enabled again afterwards', async () => {
    let resolve: (v: boolean) => void = () => {}
    const onUpdate = vi.fn(() => new Promise<boolean>(r => { resolve = r }))
    render(<KoiosChoosesLeadsSwitch vacancy={vac(false)} onUpdate={onUpdate} />)
    const sw = screen.getByRole('switch') as HTMLButtonElement
    fireEvent.click(sw)
    expect(sw.disabled).toBe(true)
    resolve(true)
    await waitFor(() => expect(sw.disabled).toBe(false))
  })

  it('is disabled without onUpdate', () => {
    render(<KoiosChoosesLeadsSwitch vacancy={vac(true)} />)
    expect((screen.getByRole('switch') as HTMLButtonElement).disabled).toBe(true)
  })
})
