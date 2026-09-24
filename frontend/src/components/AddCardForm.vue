<template>
  <el-dialog
    :model-value="visible"
    title="Add New Card"
    width="480px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:visible', $event)"
    @open="initForm"
  >
    <el-alert
      v-if="restoredDraft"
      type="warning"
      show-icon
      :closable="false"
      title="The last attempt failed to save. Your input has been restored so you can try again."
      style="margin-bottom: 12px;"
    />

    <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
      <el-form-item label="Template">
        <el-select v-model="selectedTemplate" style="width: 100%;" @change="applyTemplate">
          <el-option
            v-for="tpl in cardTemplates"
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
      <el-button @click="$emit('update:visible', false)">Cancel</el-button>
      <el-button type="primary" :loading="adding" :disabled="adding" @click="handleAdd">Add Card</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { useBoardStore } from '../stores/board.js'
import { CARD_TEMPLATES } from '../utils/cardTemplates.js'

const props = defineProps({
  visible: Boolean,
  columnId: { type: Number, default: null }
})

const emit = defineEmits(['update:visible', 'added'])

const boardStore = useBoardStore()
const formRef = ref(null)
const adding = ref(false)
const cardTemplates = CARD_TEMPLATES
const selectedTemplate = ref('blank')
const restoredDraft = ref(false)

// Input from the last failed save, restored when the dialog is reopened.
// Nothing is persisted anywhere until a save succeeds, so closing the
// dialog midway can never leave a half-created card behind.
let failedDraft = null

const emptyForm = () => ({
  title: '',
  description: '',
  priority: 'medium',
  due_date: ''
})

const form = ref(emptyForm())

const rules = {
  title: [
    { required: true, whitespace: true, message: 'Card title is required', trigger: 'blur' }
  ]
}

function resetForm() {
  form.value = emptyForm()
  selectedTemplate.value = 'blank'
}

function initForm() {
  restoredDraft.value = false
  if (failedDraft) {
    // Start from a clean state, then re-apply the input that failed to save
    form.value = { ...emptyForm(), ...failedDraft.form }
    selectedTemplate.value = failedDraft.template
    failedDraft = null
    restoredDraft.value = true
  } else {
    resetForm()
  }
  nextTick(() => formRef.value?.clearValidate())
}

function applyTemplate(key) {
  const tpl = cardTemplates.find(t => t.key === key)
  if (!tpl) return
  form.value = {
    ...form.value,
    title: tpl.title,
    description: tpl.description,
    priority: tpl.priority
  }
}

async function handleAdd() {
  // Guard against duplicate submissions (e.g. double-click while validating)
  if (adding.value || !formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  adding.value = true
  try {
    await boardStore.addCard(props.columnId, {
      title: form.value.title.trim(),
      description: form.value.description,
      priority: form.value.priority,
      due_date: form.value.due_date || null
    })
    failedDraft = null
    ElMessage.success('Card added!')
    emit('update:visible', false)
    emit('added')
  } catch (err) {
    // Stash the input so it can be restored on the next open
    failedDraft = { form: { ...form.value }, template: selectedTemplate.value }
    ElMessage.error(err.response?.data?.error || 'Failed to add card')
  } finally {
    adding.value = false
  }
}
</script>
