// Draft persistence for the add-card and edit-card dialogs.
// Drafts are stored per dialog scope so that:
// - closing a dialog midway keeps the input for the next open,
// - a failed save can be recovered,
// - a successful save removes the draft.
//
// Storage failures (private mode / quota) are swallowed: drafts are a
// best-effort safety net and must never block the dialogs.

const PREFIX = 'taskboard:draft:'

function storageKey(scope, id) {
  return `${PREFIX}${scope}:${id}`
}

export function saveCardDraft(scope, id, draft) {
  try {
    localStorage.setItem(
      storageKey(scope, id),
      JSON.stringify({ ...draft, savedAt: Date.now() })
    )
  } catch {
    // ignore quota / availability errors
  }
}

export function loadCardDraft(scope, id) {
  try {
    const raw = localStorage.getItem(storageKey(scope, id))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function clearCardDraft(scope, id) {
  try {
    localStorage.removeItem(storageKey(scope, id))
  } catch {
    // ignore
  }
}

// A draft is only worth restoring once the user entered real content.
export function hasDraftContent(draft) {
  if (!draft) return false
  return Boolean(
    (draft.title && draft.title.trim()) ||
    (draft.description && draft.description.trim())
  )
}
