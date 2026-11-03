import { useEffect, useRef } from 'react'

export default function MessageList({ messages, sending }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  if (messages.length === 0 && !sending) {
    return (
      <div className="empty-state">
        <div className="empty-orb" />
        <h2>Hey, I'm PANDU.</h2>
        <p>Ask me to open an app, set a reminder, or just talk.</p>
        <div className="empty-examples">
          <span>"Remind me to study at 7 PM"</span>
          <span>"Open VS Code"</span>
          <span>"What's my system status?"</span>
        </div>
      </div>
    )
  }

  return (
    <div className="message-list">
      {messages.map((m, i) => (
        <div key={i} className={`message-row ${m.role}`}>
          <div className={`message-bubble ${m.isError ? 'error' : ''}`}>
            {m.action && <span className="action-tag">{formatAction(m.action)}</span>}
            <p>{m.text}</p>
          </div>
        </div>
      ))}
      {sending && (
        <div className="message-row pandu">
          <div className="message-bubble typing">
            <span className="dot" />
            <span className="dot" />
            <span className="dot" />
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}

function formatAction(action) {
  const labels = {
    open_app: '⚡ opened app',
    set_reminder: '⏰ reminder set',
    search_web: '🔍 searched web',
    get_system_info: '💻 system check',
    list_files: '📁 listed files',
    create_file: '📝 file created',
  }
  return labels[action] || action
}
