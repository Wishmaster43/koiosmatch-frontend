/**
 * SectionTabs — re-export seam. The four tab components (Experience/Education/
 * Certifications/Skills) and their shared helpers now live in their own files
 * (ExperienceTab.tsx, EducationTab.tsx, CertificationsTab.tsx, SkillsTab.tsx,
 * sectionTabsShared.tsx) — this file only re-exports them so existing imports
 * from './SectionTabs' keep resolving. Prefer importing the concrete file
 * directly in new code.
 */
export { ExperienceTab } from './ExperienceTab'
export { EducationTab } from './EducationTab'
export { CertificationsTab } from './CertificationsTab'
export { SkillsTab } from './SkillsTab'
export { resolveEducationStartDate, resolveLinkedDocument } from './sectionTabsShared'
