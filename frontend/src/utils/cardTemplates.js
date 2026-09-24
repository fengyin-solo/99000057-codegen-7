// Prebuilt card templates for common scenarios.
// Used by AddCardForm to pre-fill title, description and priority.
export const CARD_TEMPLATES = [
  {
    key: 'blank',
    label: 'Blank Card',
    title: '',
    description: '',
    priority: 'medium'
  },
  {
    key: 'bug',
    label: 'Bug Report',
    title: 'Fix: ',
    description: 'Steps to reproduce:\n1. \n2. \n\nExpected behavior:\n\nActual behavior:\n',
    priority: 'high'
  },
  {
    key: 'feature',
    label: 'Feature Request',
    title: 'Feature: ',
    description: 'User story:\nAs a ..., I want ... so that ...\n\nAcceptance criteria:\n- \n',
    priority: 'medium'
  },
  {
    key: 'task',
    label: 'Task',
    title: 'Task: ',
    description: 'Goal:\n\nChecklist:\n- \n',
    priority: 'medium'
  },
  {
    key: 'meeting',
    label: 'Meeting Notes',
    title: 'Meeting: ',
    description: 'Agenda:\n- \n\nNotes:\n\nAction items:\n- \n',
    priority: 'low'
  },
  {
    key: 'research',
    label: 'Research / Spike',
    title: 'Research: ',
    description: 'Question:\n\nFindings:\n\nRecommendation:\n',
    priority: 'low'
  }
]
