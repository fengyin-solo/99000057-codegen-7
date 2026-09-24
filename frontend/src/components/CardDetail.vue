<template>
  <el-dialog
    :model-value="visible"
    width="540px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:visible', $event)"
    @open="initForm"
  >
    <template #header="{ titleId, titleClass }">
      <div class="dialog-header">
        <span :id="titleId" :class="titleClass">Card Details</span>
        <el-tag v-if="isDirty" type="warning" size="small" effect="light" round>
          Unsaved changes
        </el-tag>
      </div>
    </template>

    <el-alert
      v-if="restoredDraft"
      type="warning"
      show-icon
      :closable="false"
      title="Your previous changes could not be saved. They have been restored so you can try again."
      style="margin-bottom: 12px;"
    />

    <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
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
    </el-form>

    <template #footer>
      <el-button @click="$emit('update:visible', false)">Cancel</el-button>
      <el-button type="primary" :loading="saving" :disabled="!isDirty || saving" @click="handleSave">Save Changes</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { useBoardStore } from '../stores/board.js'

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

// cardId -> { form, moveTarget }. Input from failed saves is kept here so
// reopening the dialog restores it on top of the card's last valid state.
const failedDrafts = new Map()

const form = ref({
  title: '',
  description: '',
  priority: 'medium',
  due_date: ''
})

const rules = {
  title: [
    { required: true, whitespace: true, message: 'Title is required', trigger: 'blur' }
  ]
}

// True whenever the form differs from the card's last saved state
const isDirty = computed(() => {
  if (!props.card) return false
  return (
    form.value.title !== (props.card.title || '') ||
    form.value.description !== (props.card.description || '') ||
    form.value.priority !== (props.card.priority || 'medium') ||
    (form.value.due_date || '') !== (props.card.due_date || '') ||
    !!moveTarget.value
  )
})

function initForm() {
  restoredDraft.value = false
  if (props.card) {
    // Start from the last saved (valid) state of the card
    form.value = {
      title: props.card.title || '',
      description: props.card.description || '',
      priority: props.card.priority || 'medium',
      due_date: props.card.due_date || ''
    }
    moveTarget.value = null

    const draft = failedDrafts.get(props.card.id)
    if (draft) {
      // Re-apply the input that failed to save
      form.value = { ...form.value, ...draft.form }
      moveTarget.value = draft.moveTarget
      failedDrafts.delete(props.card.id)
      restoredDraft.value = true
    }
  }
  nextTick(() => formRef.value?.clearValidate())
}

async function handleSave() {
  // Guard against duplicate submissions (e.g. double-click while validating)
  if (saving.value || !formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  saving.value = true
  try {
    const updated = await boardStore.updateCard(props.card.id, {
      title: form.value.title.trim(),
      description: form.value.description,
      priority: form.value.priority,
      due_date: form.value.due_date || null
    })
    emit('updated', updated)
    ElMessage.success('Card updated')

    // Handle move if target column selected
    if (moveTarget.value && moveTarget.value !== props.card.column_id) {
      await boardStore.moveCard(props.card.id, moveTarget.value, 0)
      ElMessage.success('Card moved')
    }

    failedDrafts.delete(props.card.id)
    emit('update:visible', false)
  } catch (err) {
    // Stash the unsaved input so reopening restores it on top of the last valid state
    failedDrafts.set(props.card.id, { form: { ...form.value }, moveTarget: moveTarget.value })
    ElMessage.error(err.response?.data?.error || 'Failed to update card')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.dialog-header {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
