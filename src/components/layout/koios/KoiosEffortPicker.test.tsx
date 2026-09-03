/**
 * KoiosEffortPicker — offers only what the package allows (K-147, capabilities.effort):
 * hidden when unsupported, levels above `max` dropped, the default named on the clear option.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import KoiosEffortPicker from './KoiosEffortPicker'

const caps = vi.hoisted(() => ({ current: null as null | Record<string, unknown> }))
vi.mock('./useKoiosToolCapabilities', () => ({ useKoiosToolCapabilities: () => ({ capabilities: caps.current }) }))

const t = ((key: string, opts?: Record<string, unknown>) => (opts?.level ? `${key}:${opts.level}` : key)) as never

describe('KoiosEffortPicker', () => {
  it('renders nothing when the package does not support effort overrides', () => {
    caps.current = { effort: { supported: false, options: ['low', 'high'], default: 'high', max: 'max' } }
    const { container } = render(<KoiosEffortPicker value={null} onChange={() => {}} t={t} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('drops the levels above the package ceiling and names the default on the clear option', () => {
    caps.current = { effort: { supported: true, options: ['low', 'medium', 'high', 'xhigh', 'max'], default: 'high', max: 'high' } }
    render(<KoiosEffortPicker value={null} onChange={() => {}} t={t} />)
    const trigger = screen.getByRole('button', { name: /koios\.effort\.label/ })
    expect(trigger).toHaveTextContent('koios.effort.defaultWith:koios.effort.high')
    fireEvent.click(trigger)
    const listId = trigger.getAttribute('aria-controls') as string
    const labels = Array.from(document.getElementById(listId)!.querySelectorAll('button')).map((b) => b.textContent)
    expect(labels).toEqual(['koios.effort.defaultWith:koios.effort.high', 'koios.effort.low', 'koios.effort.medium', 'koios.effort.high'])
  })

  it('emits the picked level and null for the clear option', () => {
    caps.current = { effort: { supported: true, options: ['low', 'medium', 'high'], default: 'medium', max: 'high' } }
    const onChange = vi.fn()
    const { rerender } = render(<KoiosEffortPicker value={null} onChange={onChange} t={t} />)
    fireEvent.click(screen.getByRole('button', { name: /koios\.effort\.label/ }))
    fireEvent.click(screen.getByText('koios.effort.high'))
    expect(onChange).toHaveBeenLastCalledWith('high')
    rerender(<KoiosEffortPicker value="high" onChange={onChange} t={t} />)
    fireEvent.click(screen.getByRole('button', { name: /koios\.effort\.label.*koios\.effort\.high/ }))
    fireEvent.click(screen.getByText('koios.effort.defaultWith:koios.effort.medium'))
    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  it('follows the chosen flavour when the server answers per flavour', () => {
    caps.current = { effort: { supported: false, options: ['low', 'high'], default: 'high', max: 'high', supported_by_flavor: { snel: false, slim: true } } }
    const { container, rerender } = render(<KoiosEffortPicker value={null} onChange={() => {}} flavor="snel" t={t} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<KoiosEffortPicker value={null} onChange={() => {}} flavor="slim" t={t} />)
    expect(screen.getByRole('button', { name: /koios\.effort\.label/ })).toBeInTheDocument()
  })
})
