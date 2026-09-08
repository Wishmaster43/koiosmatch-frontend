/**
 * NumberInput / CurrencyInput — the house numeric fields show locale grouping at rest
 * (GETALLEN-1, also inside inputs) and hand the parsed number / cents back.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import NumberInput from './NumberInput'
import CurrencyInput from './CurrencyInput'

describe('NumberInput', () => {
  it('shows a thousand as 1.250 at rest and parses typed Dutch input', () => {
    const onChange = vi.fn()
    render(<NumberInput value={1250} onChange={onChange} ariaLabel="Aantal" />)
    const input = screen.getByRole('textbox', { name: 'Aantal' }) as HTMLInputElement
    expect(input.value).toBe('1.250')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '2.500' } })
    expect(onChange).toHaveBeenLastCalledWith(2500)
    fireEvent.change(input, { target: { value: '2500' } })
    expect(onChange).toHaveBeenLastCalledWith(2500)
  })

  it('re-formats, clamps and rounds on blur', () => {
    const onChange = vi.fn()
    render(<NumberInput value={10} onChange={onChange} min={0} max={100} ariaLabel="Procent" />)
    const input = screen.getByRole('textbox', { name: 'Procent' }) as HTMLInputElement
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '250,7' } })
    fireEvent.blur(input)
    expect(onChange).toHaveBeenLastCalledWith(100)
    expect(input.value).toBe('100')
  })

  it('an emptied field hands back null', () => {
    const onChange = vi.fn()
    render(<NumberInput value={5} onChange={onChange} ariaLabel="Leeg" />)
    const input = screen.getByRole('textbox', { name: 'Leeg' })
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '' } })
    expect(onChange).toHaveBeenLastCalledWith(null)
  })
})

describe('CurrencyInput', () => {
  it('shows cents as euros with two decimals and stores typed euros as cents', () => {
    const onChange = vi.fn()
    render(<CurrencyInput cents={9900} onChange={onChange} ariaLabel="Prijs" />)
    const input = screen.getByRole('textbox', { name: 'Prijs' }) as HTMLInputElement
    expect(input.value).toBe('99,00')
    expect(screen.getByText('€')).toBeTruthy()
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '149,50' } })
    expect(onChange).toHaveBeenLastCalledWith(14950)
    fireEvent.change(input, { target: { value: '1.999' } })
    expect(onChange).toHaveBeenLastCalledWith(199900)
  })
})

describe('NumberInput range notice', () => {
  it('says the maximum out loud when a typed value is clamped', () => {
    const onChange = vi.fn()
    render(<NumberInput value={12} onChange={onChange} min={1} max={120} ariaLabel="Maanden" />)
    const input = screen.getByRole('textbox', { name: 'Maanden' })
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '200' } })
    fireEvent.blur(input)
    expect(onChange).toHaveBeenLastCalledWith(120)
    expect(screen.getByRole('status').textContent).toBe('Maximaal 120')
    expect(input.getAttribute('aria-invalid')).toBe('true')
  })
})
