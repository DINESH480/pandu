import { useState, useEffect, useRef } from 'react'
import { supabase } from '../utils/supabase'
import { sendMessage, getConversations } from '../utils/api'
import MessageList from '../components/MessageList'
import ChatInput from '../components/ChatInput'
import Sidebar from '../components/Sidebar'

export default function ChatPage({ session }) {
  const [messages, setMessages] = useState([])
  const [sessionId, setSessionId] = useState(null)
  const [sending, setSending] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [voiceMode, setVoiceMode] = useState(false)
  const userId = session.user.id
  const speechSynthesisRef = useRef(null)

  useEffect(() => {
    loadHistory()
  }, [])

  async function loadHistory() {
    try {
      const { conversations } = await getConversations(userId)
      const formatted = []
      // conversations come back newest-first, so reverse for display order
      for (const c of [...conversations].reverse()) {
        formatted.push({ role: 'user', text: c.user_message })
        formatted.push({ role: 'pandu', text: c.ai_response, action: c.action_taken })
      }
      setMessages(formatted)
      if (conversations.length > 0) {
        setSessionId(conversations[0].session_id)
      }
    } catch (err) {
      console.error('Could not load history:', err)
    }
  }

  async function handleSend(text, options = {}) {
    if (!text.trim()) return
    const speak = voiceMode || options.voice === true

    setMessages((prev) => [...prev, { role: 'user', text }])
    setSending(true)

    try {
      const result = await sendMessage(text, userId, sessionId, speak)
      setSessionId(result.session_id)
      setMessages((prev) => [
        ...prev,
        { role: 'pandu', text: result.response, action: result.action_taken },
      ])
      if (speak) {
        speakResponse(result.response)
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'pandu', text: `Something went wrong: ${err.message}`, isError: true },
      ])
    } finally {
      setSending(false)
    }
  }

  function speakResponse(text) {
    if (!window.speechSynthesis || typeof window.SpeechSynthesisUtterance !== 'function') {
      return
    }

    window.speechSynthesis.cancel()
    const utterance = new window.SpeechSynthesisUtterance(text)
    const voices = window.speechSynthesis.getVoices()
    const language = navigator.language || 'en-US'
    utterance.voice =
      voices.find((voice) => voice.lang.toLowerCase() === language.toLowerCase()) ||
      voices.find((voice) => voice.lang.toLowerCase().startsWith(language.split('-')[0].toLowerCase())) ||
      null
    utterance.lang = language
    utterance.rate = 1
    speechSynthesisRef.current = utterance
    window.speechSynthesis.speak(utterance)
  }

  function toggleVoiceMode() {
    if (!voiceMode && (!window.speechSynthesis || typeof window.SpeechSynthesisUtterance !== 'function')) {
      alert('Voice responses are not supported in this browser. Try Chrome or Edge.')
      return
    }

    if (voiceMode) {
      window.speechSynthesis.cancel()
      speechSynthesisRef.current = null
    }
    setVoiceMode((enabled) => !enabled)
  }

  useEffect(() => () => {
    window.speechSynthesis?.cancel()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  function handleNewChat() {
    setSessionId(null)
    setMessages([])
    setSidebarOpen(false)
  }

  return (
    <div className="chat-shell">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNewChat={handleNewChat}
        onLogout={handleLogout}
        userEmail={session.user.email}
      />

      <main className="chat-main">
        <header className="chat-header">
          <button className="icon-btn" onClick={() => setSidebarOpen(true)}>
            ☰
          </button>
          <div className="chat-header-title">
            <span className="status-dot" />
            PANDU
          </div>
          <button
            type="button"
            className={`voice-mode-btn ${voiceMode ? 'active' : ''}`}
            onClick={toggleVoiceMode}
            aria-pressed={voiceMode}
          >
            {voiceMode ? '🔊 Voice mode' : '💬 Chat mode'}
          </button>
        </header>

        <MessageList messages={messages} sending={sending} />
        <ChatInput
          onSend={handleSend}
          disabled={sending}
          voiceMode={voiceMode}
          onToggleVoiceMode={toggleVoiceMode}
        />
      </main>
    </div>
  )
}
