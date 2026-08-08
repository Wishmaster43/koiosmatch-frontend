// The Stats-tab -> Targets-tab click-to-filter axis (G31): a donut segment click
// narrows the Targets tab list to that one status/outcome/assignee value. Lives
// in the OutreachDrawer container (shared between both tabs); null = no filter.
export type TargetFilter = { axis: 'status' | 'outcome' | 'assignee'; value: string } | null
