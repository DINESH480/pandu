import { supabase } from './supabase'

/**
 * PANDU API Client
 * All communication with the FastAPI backend goes through here.
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function request(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`
  const isFormData = options.body instanceof FormData
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError

  const response = await fetch(url, {
    ...options,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...options.headers,
    },
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Network error' }))
    throw new Error(error.detail || `HTTP ${response.status}`)
  }
  return response.json()
}

export const transcribeAudio = (audio, filename) => {
  const formData = new FormData()
  formData.append('file', audio, filename)
  return request('/transcribe', { method: 'POST', body: formData })
}

// Send a chat message to PANDU
export const sendMessage = (message, userId, sessionId, useVoice = false) =>
  request('/chat', {
    method: 'POST',
    body: JSON.stringify({
      message,
      user_id: userId,
      session_id: sessionId,
      use_voice: useVoice,
    }),
  })

// Get conversation history
export const getConversations = (userId) =>
  request(`/conversations/${userId}`)

// Get all sessions
export const getSessions = (userId) =>
  request(`/sessions/${userId}`)

// Reminders
export const createReminder = (userId, text, remindAt) =>
  request('/reminders', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, text, remind_at: remindAt }),
  })

export const getReminders = (userId) =>
  request(`/reminders/${userId}`)

export const markReminderDone = (reminderId) =>
  request(`/reminders/${reminderId}/done`, { method: 'PATCH' })

// System info
export const getSystemInfo = () =>
  request('/system/info')

// Health check
export const checkHealth = () =>
  request('/health')
