// Common scenarios used to prefill the add-card dialog.
// Only title / description / priority are prefilled (due date is left out).
export const CARD_TEMPLATES = [
  {
    key: 'bug',
    label: 'Bug Report',
    title: 'Bug: describe the issue',
    description:
      'Steps to reproduce:\n1. \n2. \n\nExpected behavior:\nActual behavior:',
    priority: 'high'
  },
  {
    key: 'feature',
    label: 'Feature Request',
    title: 'Feature: describe the request',
    description:
      'As a user, I want to ...\n\nAcceptance criteria:\n- [ ] \n- [ ] ',
    priority: 'medium'
  },
  {
    key: 'task',
    label: 'General Task',
    title: 'New task',
    description: 'What needs to be done:\n\nDefinition of done:\n- ',
    priority: 'low'
  },
  {
    key: 'blocker',
    label: 'Urgent Blocker',
    title: 'Blocker: what is blocked',
    description: 'Impact:\n\nWorkaround:\n\nNeeded by:',
    priority: 'high'
  },
  {
    key: 'discussion',
    label: 'Meeting / Discussion',
    title: 'Discuss: topic',
    description: 'Agenda:\n- \n\nDecisions needed:\n',
    priority: 'low'
  }
]
