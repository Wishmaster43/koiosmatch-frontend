// scanState — side-effect-free virus-scan helpers shared by candidates, customers, vacancies and applications.
export type ScanStatus = 'pending' | 'clean' | 'rejected'

// UPLOADS-SCAN-1: the scan state worth showing, null for clean/absent (a row from before the field).
export const scanState = (s?: ScanStatus | null): 'pending' | 'rejected' | null => (s === 'pending' || s === 'rejected' ? s : null)
