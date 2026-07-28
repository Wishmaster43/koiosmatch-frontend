import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import CreatableSelect from './src/components/ui/CreatableSelect'

describe('probe', () => {
  it('legit falsy value with a matching option renders that option label', () => {
    render(<CreatableSelect value="" onChange={() => {}} options={[{ value: '', label: 'Bureau (niemand)' }, { value: '1', label: 'Ann' }]} allowCreate={false} />)
    const btn = screen.getByRole('button')
    // eslint-disable-next-line no-console
    console.log('PROBE legit-falsy text:', JSON.stringify(btn.textContent), 'color:', (btn.firstElementChild as HTMLElement).style.color)
    expect(btn).toHaveTextContent('Bureau (niemand)')
  })

  it("value='' without a placeholder renders the dash", () => {
    render(<CreatableSelect value="" onChange={() => {}} options={['A', 'B']} allowCreate={false} />)
    const btn = screen.getByRole('button')
    // eslint-disable-next-line no-console
    console.log('PROBE no-placeholder text:', JSON.stringify(btn.textContent), 'color:', (btn.firstElementChild as HTMLElement).style.color)
  })

  it("value='' with placeholder: colour half", () => {
    render(<CreatableSelect value="" onChange={() => {}} options={['A', 'B']} placeholder="Selecteer" allowCreate={false} />)
    const btn = screen.getByRole('button')
    // eslint-disable-next-line no-console
    console.log('PROBE placeholder text:', JSON.stringify(btn.textContent), 'color:', (btn.firstElementChild as HTMLElement).style.color)
  })
})
