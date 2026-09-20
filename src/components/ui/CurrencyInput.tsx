/**
 * CurrencyInput — a money field that shows EUROS and stores CENTS. The API keeps every
 * amount as an integer in cents (BE GETALLEN-1); the user never types cents (Danny
 * 09-09: "why can't this just be in euros, I don't want cents"). Composes
 * NumberInput with two decimals and the tenant currency symbol as prefix.
 */
import type { ReactNode } from 'react'
import NumberInput from './NumberInput'
import { useNumberFormat } from '@/lib/formatters'

export interface CurrencyInputProps {
  cents: number | null | undefined
  onChange: (cents: number | null) => void
  min?: number
  width?: number | string
  unit?: ReactNode
  disabled?: boolean
  ariaLabel?: string
  id?: string
  mono?: boolean
}

export default function CurrencyInput({ cents, onChange, min = 0, width = 120, unit, disabled, ariaLabel, id, mono }: CurrencyInputProps) {
  const { formatCurrency } = useNumberFormat()
  // The currency symbol as the locale writes it ("€"), taken from the formatter so a
  // tenant in another currency gets its own sign without a second symbol table.
  const symbol = formatCurrency(0).replace(/[\d.,\s\u00A0]/g, '')
  return (
    <NumberInput
      id={id} ariaLabel={ariaLabel} disabled={disabled} width={width} unit={unit} mono={mono}
      decimals={2} min={min / 100} prefix={symbol}
      value={cents == null ? null : cents / 100}
      onChange={euros => onChange(euros == null ? null : Math.round(euros * 100))}
    />
  )
}
