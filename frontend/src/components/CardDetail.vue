<template>
  <el-dialog
    :model-value="visible"
    width="540px"
    :close-on-click-modal="false"
    :before-close="handleBeforeClose"
    @update:model-value="$emit('update:visible', $event)"
    @open="initForm"
  >
    <template #header>
      <div class="detail-header">
        <span class="detail-title">Card Details</span>
        <el-tag v-if="isDirty" type="warning" size="small" effect="plain" round>
          <el-icon style="vertical-align: -2px;"><WarningFilled /></el-icon>
          Unsaved changes
        </el-tag>
      </div>
    </template>

    <el-alert
      v-if="restoredDraft"
      type="info"
      :closable="false"
      show-icon
      style="margin-bottom: 16px;"
    >
      <template #title>
        Restored your unsaved edits from last time.
        <el-button link type="primary" size="small" @click="discardDraft">Discard</el-button>
      </template>
    </el-alert>

    <el-form ref="formRef" :model="form" :rules="rules" label-position="top" @submit.prevent>
      <el-form-item label="Title" prop="title">
        <el-input v-model="form.title" placeholder="Card title" maxlength="100" show-word-limit />
      </el-form-item>

      <el-form-item label="Description" prop="description">
        <el-input v-model="form.description" type="textarea" :rows="4" placeholder="Card description" maxlength="500" show-word-limit />
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

      <el-form-item v-if="allColumns.length > 1" label="Move to Column">
        <el-select v-model="moveTarget" placeholder="Select column (optional)" clearable style="width: 100%;">
          <el-option
            v-for="col in allColumns"
            :key="col.id"
            :label="col.name"
            :value="col.id"
            :disabled="col.id === card?.column_id"
          />
        </el-select>
      </el-form-item>

      <!-- Save state helper: always tells the user where they stand -->
      <div class="save-status" :class="statusClass">
        <el-icon v-if="saving" class="is-loading"><Loading /></el-icon>
        <el-icon v-else-if="isDirty"><WarningFilled /></el-icon>
        <el-icon v-else><CircleCheckFilled /></el-icon>
        <span>{{ statusText }}</span>
      </div>
    </el-form>

    <template #footer>
      <el-button :disabled="saving" @click="handleCancel">Cancel</el-button>
      <el-button type="primary" :loading="saving" @click="handleSave">Save Changes</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { WarningFilled, CircleCheckFilled, Loading } from '@element-plus/icons-vue'
import { useBoardStore } from '../stores/board.js'
import { saveCardDraft, loadCardDraft, clearCardDraft } from '../utils/cardDraft.js'

const props = defineProps({
  visible: Boolean,
  card: { type: Object, default: null },
  allColumns: { type: Array, default: () => [] }
})

const emit = defineEmits(['update:visible', 'updated', 'move'])

const boardStore = useBoardStore()
const formRef = ref(null)
const saving = ref(false)
const moveTarget = ref(null)
const restoredDraft = ref(false)

const form = ref({
  title: '',
  description: '',
  priority: 'medium',
  due_date: ''
})

// Snapshot of the last known-good (server) state. Editing always starts
// from here; a failed save can never corrupt it.
const baseline = ref(normalizeCard(props.card))

const rules = {
  title: [
    { required: true, message: 'Title is required', trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        if (value && !value.trim()) callback(new Error('Title cannot be empty'))
        else callback()
      },
      trigger: 'blur'
    }
  ]
}

function normalizeCard(card) {
  return {
    title: card?.title || '',
    description: card?.description || '',
    priority: card?.priority || 'medium',
    due_date: card?.due_date || ''
  }
}

const isDirty = computed(() => {
  return (
    form.value.title !== baseline.value.title ||
    form.value.description !== baseline.value.description ||
    form.value.priority !== baseline.value.priority ||
    form.value.due_date !== baseline.value.due_date ||
    (moveTarget.value !== null && moveTarget.value !== props.card?.column_id)
  )
})

const statusText = computed(() => {
  if (saving.value) return 'Saving changes...'
  if (isDirty.value) return 'You have unsaved changes'
  return 'All changes saved'
})

const statusClass = computed(() => {
  if (saving.value) return 'is-saving'
  return isDirty.value ? 'is-dirty' : 'is-clean'
})

// Auto-persist the work in progress (including a pending move), so a
// failed save or a dialog closed midway can be fully recovered.
watch(
  [form, moveTarget],
  () => {
    if (!props.card) return
    // For editing, a "draft" only exists while something differs from
    // the last saved state — a normal saved card always has a title.
    if (isDirty.value) {
      saveCardDraft('edit', props.card.id, {
        ...form.value,
        moveTarget: moveTarget.value
      })
    } else {
      clearCardDraft('edit', props.card.id)
    }
  },
  { deep: true }
)

function draftDiffers(draft) {
  if (!draft) return false
  return (
    (draft.title ?? baseline.value.title) !== baseline.value.title ||
    (draft.description ?? baseline.value.description) !== baseline.value.description ||
    (draft.priority || baseline.value.priority) !== baseline.value.priority ||
    (draft.due_date ?? baseline.value.due_date) !== baseline.value.due_date ||
    Boolean(draft.moveTarget && draft.moveTarget !== props.card?.column_id)
  )
}

function initForm() {
  if (!props.card) return
  formRef.value?.clearValidate?.()
  baseline.value = normalizeCard(props.card)

  // Reopen returns to the last valid state, then restores any unsaved
  // input from the failed/abandoned session on top of it.
  const draft = loadCardDraft('edit', props.card.id)
  if (draftDiffers(draft)) {
    form.value = {
      title: draft.title ?? baseline.value.title,
      description: draft.description ?? baseline.value.description,
      priority: draft.priority || baseline.value.priority,
      due_date: draft.due_date ?? baseline.value.due_date
    }
    const target = draft.moveTarget
    moveTarget.value = target && target !== props.card.column_id ? target : null
    restoredDraft.value = true
  } else {
    form.value = { ...baseline.value }
    moveTarget.value = null
    restoredDraft.value = false
    clearCardDraft('edit', props.card.id)
  }
}

function discardDraft() {
  if (!props.card) return
  form.value = { ...baseline.value }
  moveTarget.value = null
  restoredDraft.value = false
  clearCardDraft('edit', props.card.id)
  formRef.value?.clearValidate?.()
}

function handleCancel() {
  if (saving.value) {
    ElMessage.warning('Changes are still being saved...')
    return
  }
  emit('update:visible', false)
}

function handleBeforeClose(done) {
  if (saving.value) {
    ElMessage.warning('Changes are still being saved...')
    return
  }
  done()
}

async function handleSave() {
  // Guard against duplicate submits.
  if (saving.value) return
  if (!props.card || !formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  const title = form.value.title.trim()
  const wantsMove = moveTarget.value && moveTarget.value !== props.card.column_id

  saving.value = true
  try {
    // The store only mutates local card state after the API succeeds,
    // so a failure can never leave a half-updated card.
    const updated = await boardStore.updateCard(props.card.id, {
      title,
      description: form.value.description,
      priority: form.value.priority,
      due_date: form.value.due_date || null
    })
    emit('updated', updated)
    baseline.value = normalizeCard(updated)

    if (wantsMove) {
      try {
        await boardStore.moveCard(props.card.id, moveTarget.value, 0)
      } catch (moveErr) {
        // Edits are saved, but the move failed: keep the dialog open so
        // the user can retry or clear the target instead of losing it.
        ElMessage.error('Card updated, but moving it failed. Try saving the move again.')
        saving.value = false
        return
      }
      ElMessage.success('Card updated and moved')
    } else {
      ElMessage.success('Card updated')
    }

    clearCardDraft('edit', props.card.id)
    restoredDraft.value = false
    moveTarget.value = null
    emit('update:visible', false)
  } catch (err) {
    // Dialog stays open with every input intact; reopening restores it.
    ElMessage.error(err.response?.data?.error || 'Failed to update card')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.detail-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.detail-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.save-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  margin-top: -4px;
}

.save-status.is-dirty {
  color: #e6a23c;
}

.save-status.is-clean {
  color: #67c23a;
}

.save-status.is-saving {
  color: #409eff;
}
</style>
