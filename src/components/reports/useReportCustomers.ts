/**
 * useReportCustomers — data layer for the ShiftManager customers report table.
 * Fetches /sm_customers once and exposes { customers, loading, error }. When
 * USE_MOCKS is on (dev only), seed demo customers are merged in so the screen has
 * data without a backend. `error` is a boolean; the view maps it to a translated
 * message so i18n stays in the component (§3, §5). Cancels on unmount.
 */
import { useState, useEffect } from 'react'
import api, { unwrapList } from '@/lib/api'
import { USE_MOCKS } from '@/lib/mocks'
import type { ReportCustomer } from '@/types/reports'

// Demo customer tree (dev fallback only) — merged in behind USE_MOCKS.
const DUMMY_CUSTOMERS: ReportCustomer[] = [
  {
    id: 'dummy-1', name: 'Zorgpartners Midden-Holland', debtor_number: 'DEB-1001',
    status: 'active', account_manager: 'Iris de Wit',
    locations: [
      {
        id: 'loc-1', name: 'Zorgpartners Midden-Holland HQ', status: 'active',
        street: 'Anna van Meertenstraat', house_number: '12', postal_code: '2804 TL', city: 'Gouda',
        departments: [
          { id: 'd1', name: 'Verpleging', cost_center: 'VP-001' },
          { id: 'd2', name: 'Verzorging IG', cost_center: 'VZ-002' },
          { id: 'd3', name: 'Helpende Plus', cost_center: 'HP-003' },
        ],
      },
      {
        id: 'loc-2', name: 'Centrum De Breeje Hendrick', status: 'active',
        street: 'Nicolaas Beetsstraat', house_number: '1', postal_code: '2941 TN', city: 'Lekkerkerk',
        departments: [
          { id: 'd4', name: 'Dagbesteding', cost_center: 'DB-004' },
          { id: 'd5', name: 'Revalidatie', cost_center: 'RV-005' },
        ],
      },
      {
        id: 'loc-3', name: 'Centrum Irishof', status: 'active',
        street: 'Middenmolenplein', house_number: '266', postal_code: '2803 ZR', city: 'Gouda',
        departments: [
          { id: 'd6', name: 'Verpleegkundige zorg', cost_center: 'VPK-006' },
        ],
      },
      {
        id: 'loc-4', name: 'Ronssehof / Ronssehof Revalidatie', status: 'active',
        street: 'Ronsseweg', house_number: '410', postal_code: '2803 ZX', city: 'Gouda',
        departments: [
          { id: 'd7', name: 'Revalidatie', cost_center: 'RV-007' },
          { id: 'd8', name: 'Geriatrie', cost_center: 'GR-008' },
        ],
      },
      {
        id: 'loc-5', name: 'Centrum De Hanepraij', status: 'active',
        street: 'Fluwelensingel', house_number: '110', postal_code: '2806 CH', city: 'Gouda',
        departments: [
          { id: 'd9', name: 'Verzorging', cost_center: 'VZ-009' },
          { id: 'd10', name: 'Helpende', cost_center: 'HL-010' },
        ],
      },
    ],
  },
  {
    id: 'dummy-2', name: 'Amsterdam UMC', debtor_number: 'DEB-1002',
    status: 'active', account_manager: 'Iris de Wit',
    locations: [
      {
        id: 'loc-6', name: 'Amsterdam UMC — Locatie AMC', status: 'active',
        street: 'Meibergdreef', house_number: '9', postal_code: '1105 AZ', city: 'Amsterdam',
        departments: [
          { id: 'd11', name: 'Cardiologie', cost_center: 'CAR-011' },
          { id: 'd12', name: 'Neurologie', cost_center: 'NEU-012' },
          { id: 'd13', name: 'Oncologie', cost_center: 'ONC-013' },
          { id: 'd14', name: 'Spoedeisende hulp', cost_center: 'SEH-014' },
        ],
      },
      {
        id: 'loc-7', name: 'Amsterdam UMC — Locatie VUmc', status: 'active',
        street: 'De Boelelaan', house_number: '1117', postal_code: '1081 HV', city: 'Amsterdam',
        departments: [
          { id: 'd15', name: 'Chirurgie', cost_center: 'CHR-015' },
          { id: 'd16', name: 'Psychiatrie', cost_center: 'PSY-016' },
        ],
      },
    ],
  },
  {
    id: 'dummy-3', name: 'Stichting Zuidwester', debtor_number: 'DEB-1003',
    status: 'active', account_manager: 'Iris de Wit',
    locations: [
      {
        id: 'loc-8', name: 'Zuidwester Hoofdkantoor', status: 'active',
        street: 'Kade', house_number: '2', postal_code: '3251 LB', city: 'Stellendam',
        departments: [
          { id: 'd17', name: 'Begeleiding', cost_center: 'BG-017' },
          { id: 'd18', name: 'Dagactiviteiten', cost_center: 'DA-018' },
        ],
      },
    ],
  },
  {
    id: 'dummy-4', name: 'Ikazia Ziekenhuis', debtor_number: 'DEB-1004',
    status: 'inactive', account_manager: 'Iris de Wit',
    locations: [
      {
        id: 'loc-9', name: 'Ikazia Rotterdam', status: 'inactive',
        street: 'Montessoriweg', house_number: '1', postal_code: '3083 AN', city: 'Rotterdam',
        departments: [
          { id: 'd19', name: 'Interne geneeskunde', cost_center: 'IG-019' },
          { id: 'd20', name: 'Verloskunde', cost_center: 'VL-020' },
          { id: 'd21', name: 'Kindergeneeskunde', cost_center: 'KG-021' },
        ],
      },
    ],
  },
]

export function useReportCustomers(): { customers: ReportCustomer[]; loading: boolean; error: boolean } {
  const [customers, setCustomers] = useState<ReportCustomer[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true); setError(false)
    api.get('/sm_customers')
      .then(res => {
        if (!active) return
        const { rows: real } = unwrapList<ReportCustomer>(res)
        if (USE_MOCKS) {
          const realIds = new Set(real.map(c => c.id))
          const dummies = DUMMY_CUSTOMERS.filter(d => !realIds.has(d.id))
          setCustomers([...dummies, ...real])
        } else {
          setCustomers(real)
        }
      })
      .catch(() => { if (active) { setError(true); setCustomers(USE_MOCKS ? DUMMY_CUSTOMERS : []) } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  return { customers, loading, error }
}
