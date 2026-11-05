/** Shared DATA fixture for the CustomersReport suites (plain data, no mocks). */
/* eslint-disable no-restricted-syntax -- NECESSITY: fixture seed data (status colours), not a component style */
import type { CustomersReportData } from '@/types/analytics'

export const data: CustomersReportData = {
  period: 'month', from: '2026-08-01', to: '2026-08-31', total: 13,
  timeseries: { bucket: 'week', series: [{ date: '2026-08-03', label: 'Wk 32', value: 5 }, { date: '2026-08-10', label: 'Wk 33', value: 8 }] },
  by_status:  [{ value: 'active', label: 'Actief', color: '#16a34a', count: 9 }, { value: 'inactive', label: 'Inactief', color: '#dc2626', count: 3 },
               { value: 'zzz-deleted-status', label: 'Onbekend (verwijderde status)', color: null, count: 1 }],
  by_phase:   [{ value: 'lead', label: 'Lead', color: null, count: 4 }, { value: 'customer', label: 'Klant', color: null, count: 9 }],
  by_industry: [{ value: 'healthcare', label: 'Zorg', color: null, count: 13 }],
  by_owner:   [{ owner_id: 'u1', name: 'Anna de Vries', count: 9 }, { owner_id: 'none', name: 'Niet toegewezen', count: 4 }],
  by_branch:  [{ value: 'utrecht', label: 'Utrecht', color: null, count: 13 }],
  // KPI-CUSTOMERS-SIGNALS-1: the nine STANDING signal counts the Klanten strip
  // now reads verbatim — distinct values so a KPI-card assertion can never
  // accidentally match a different card's number.
  kpis: [
    { key: 'contract_ending', label: 'Overeenkomst loopt af', count: 7 },
    { key: 'no_contact', label: 'Lang geen contact', count: 2 },
    { key: 'task_overdue', label: 'Taak te laat', count: 11 },
    { key: 'price_agreement_ending', label: 'Prijsafspraak loopt af', count: 5 },
    { key: 'vacancy_stale', label: 'Vacature verouderd', count: 14 },
    { key: 'departments_without_placement', label: 'Afdelingen zonder plaatsing', count: 3 },
    { key: 'customers_without_vacancies', label: 'Klanten zonder vacatures', count: 6 },
    { key: 'customers_without_applications', label: 'Klanten zonder sollicitaties', count: 15 },
    { key: 'matches_stopped_early', label: 'Vroegtijdig gestopte matches', count: 12 },
  ],
}
