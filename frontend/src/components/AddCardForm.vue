<template>
  <el-dialog
    :model-value="visible"
    title="Add New Card"
    width="480px"
    :close-on-click-modal="false"
    :before-close="handleBeforeClose"
    @update:model-value="$emit('update:visible', $event)"
    @open="initForm"
  >
    <el-alert
      v-if="restoredDraft"
      type="info"
      :closable="false"
      show-icon
      style="margin-bottom: 16px;"
    >
      <template #title>
        Restored your unsaved card from last time.
        <el-button link type="primary" size="small" @click="discardDraft">Discard</el-button>
      </template>
    </el-alert>

    <el-form ref="formRef" :model="form" :rules="rules" label-position="top" @submit.prevent>
      <el-form-item label="Start from a template (optional)">
        <el-select
          v-model="selectedTemplate"
          placeholder="Choose a common scenario..."
          clearable
          style="width: 100%;"
          @change="applyTemplate"
        >
          <el-option
            v-for="tpl in CARD_TEMPLATES"
            :key="tpl.key"
            :label="tpl.label"
            :value="tpl.key"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="Title" prop="title">
        <el-input v-model="form.title" placeholder="Enter card title" maxlength="100" show-word-limit />
      </el-form-item>

      <el-form-item label="Description" prop="description">
        <el-input v-model="form.description" type="textarea" :rows="3" placeholder="Enter card description (optional)" maxlength="500" show-word-limit />
      </el-form-item>

      <div style="display: flex; gap: 16px;">
        <el-form-item label="Priority" prop="priority" style="flex: 1;">
          <el-select v-model="form.priority" style="width: 100%;">
            <el-option label="Low" value="low" />
            <el-option label="Medium" value="medium" />
            <el-option label="High" value="high" />
          </el-select>
        </el-form-item>

        <el-form-item label="Due Date" prop="due_date" style="flex: 1;">
          <el-date-picker
            v-model="form.due_date"
            type="date"
            placeholder="Select date"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            style="width: 100%;"
          />
        </el-form-item>
      </div>
    </el-form>

    <template #footer>
      <el-button :disabled="adding" @click="handleCancel">Cancel</el-button>
      <el-button type="primary" :loading="adding" @click="handleAdd">Add Card</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useBoardStore } from '../stores/board.js'
import { CARD_TEMPLATES } from '../constants/cardTemplates.js'
import { saveCardDraft, loadCardDraft, clearCardDraft, hasDraftContent } from '../utils/cardDraft.js'

const props = defineProps({
  visible: Boolean,
  columnId: { type: Number, default: null }
})

const emit = defineEmits(['update:visible', 'added'])

const boardStore = useBoardStore()
const formRef = ref(null)
const adding = ref(false)
const selectedTemplate = ref('')
const restoredDraft = ref(false)
// Tracks the last successful save attempt for this column so the next
// open always starts from the last valid state.
const skipNextDraftWatch = ref(false)

const emptyForm = () => ({
  title: '',
  description: '',
  priority: 'medium',
  due_date: ''
})

const form = ref(emptyForm())

const rules = {
  title: [
    { required: true, message: 'Card title is required', trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        if (value && !value.trim()) callback(new Error('Card title cannot be empty'))
        else callback()
      },
      trigger: 'blur'
    }
  ]
}

// Persist input continuously so a failed save or a closed dialog can
// never lose what the user typed.
watch(
  form,
  (value) => {
    if (skipNextDraftWatch.value) {
      skipNextDraftWatch.value = false
      return
    }
    if (hasDraftContent(value)) {
      saveCardDraft('add', props.columnId ?? 'new', value)
    } else {
      clearCardDraft('add', props.columnId ?? 'new')
    }
  },
  { deep: true }
)

function initForm() {
  formRef.value?.clearValidate?.()
  const draft = loadCardDraft('add', props.columnId ?? 'new')
  if (hasDraftContent(draft)) {
    // Reopen returns to the last valid state: the blank form, with the
    // unsaved input restored on top of it.
    form.value = {
      title: draft.title || '',
      description: draft.description || '',
      priority: draft.priority || 'medium',
      due_date: draft.due_date || ''
    }
    restoredDraft.value = true
  } else {
    form.value = emptyForm()
    restoredDraft.value = false
  }
  selectedTemplate.value = ''
}

function applyTemplate(key) {
  const tpl = CARD_TEMPLATES.find(t => t.key === key)
  skipNextDraftWatch.value = true
  if (tpl) {
    form.value = {
      title: tpl.title,
      description: tpl.description,
      priority: tpl.priority,
      due_date: ''
    }
  } else {
    form.value = emptyForm()
  }
  formRef.value?.clearValidate?.()
}

function discardDraft() {
  skipNextDraftWatch.value = true
  form.value = emptyForm()
  selectedTemplate.value = ''
  restoredDraft.value = false
  clearCardDraft('add', props.columnId ?? 'new')
  formRef.value?.clearValidate?.()
}

function handleCancel() {
  // Closing mid-save would orphan the request with no feedback.
  if (adding.value) {
    ElMessage.warning('Card is still being saved...')
    return
  }
  emit('update:visible', false)
}

function handleBeforeClose(done) {
  // X / ESC / modal: same guard as Cancel.
  if (adding.value) {
    ElMessage.warning('Card is still being saved...')
    return
  }
  done()
}

async function handleAdd() {
  // Guard against duplicate submits (double click / Enter spam).
  if (adding.value) return
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  const title = form.value.title.trim()
  adding.value = true
  try {
    // The store only adds the card to local state after the API
    // succeeds, so no half-created card can ever be left behind.
    await boardStore.addCard(props.columnId, {
      title,
      description: form.value.description,
      priority: form.value.priority,
      due_date: form.value.due_date || null
    })
    clearCardDraft('add', props.columnId ?? 'new')
    restoredDraft.value = false
    ElMessage.success('Card added!')
    emit('update:visible', false)
    emit('added')
  } catch (err) {
    // Keep the dialog open and the input intact; reopening after the
    // failure restores exactly these values.
    ElMessage.error(err.response?.data?.error || 'Failed to add card')
  } finally {
    adding.value = false
  }
}
</script>
