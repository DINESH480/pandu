export default function Sidebar({ open, onClose, onNewChat, onLogout, userEmail }) {
  return (
    <>
      {open && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-top">
          <div className="sidebar-brand">
            <div className="sidebar-orb" />
            PANDU
          </div>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>

        <button className="new-chat-btn" onClick={onNewChat}>
          + New conversation
        </button>

        <div className="sidebar-spacer" />

        <div className="sidebar-footer">
          <p className="sidebar-email">{userEmail}</p>
          <button className="logout-btn" onClick={onLogout}>Sign out</button>
        </div>
      </aside>
    </>
  )
}
