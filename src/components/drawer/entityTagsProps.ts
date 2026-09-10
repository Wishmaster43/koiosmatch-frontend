// C-41: the free-form tags prop bag EntityHeader consumes (`tags` + `tagsLabel`),
// shared by every drawer that persists its tag list through one setter (the
// candidate/customer drawers wrap their setter differently and are left inline —
// DRY round 11, DRAWERS).
export function entityTagsProps(currentTags: string[], setTagsAndSave: (next: string[]) => void, addLabel: string) {
  return {
    tags: {
      items: currentTags,
      onAdd: (tag: string) => setTagsAndSave([...currentTags, tag]),
      onRemove: (tag: string) => setTagsAndSave(currentTags.filter(x => x !== tag)),
      addLabel,
    },
    tagsLabel: addLabel,
  }
}
