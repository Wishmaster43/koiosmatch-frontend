/** StatusListEditor test kit: the shared lookup-row fixture (plain data, no mocks). */
export interface TypeFixture { id: string; name: string; color: string; is_default: boolean; in_use?: boolean }

// A fixture lookup row, overridable per test.
// eslint-disable-next-line no-restricted-syntax -- DATA: a fixture type's tenant-picked colour, not a style rule.
export const type = (over: Partial<TypeFixture> = {}): TypeFixture => ({ id: 't1', name: 'Intake', color: '#3B8FD4', is_default: false, ...over })
