export default function KeyboardHelp({ isOpen, onClose }) {
  if (!isOpen) return null

  const shortcuts = [
    { keys: ['⌘', 'K'], desc: 'Search articles' },
    { keys: ['j'], desc: 'Next article' },
    { keys: ['k'], desc: 'Previous article' },
    { keys: ['↵'], desc: 'Open focused article' },
    { keys: ['?'], desc: 'Toggle this help' },
    { keys: ['Esc'], desc: 'Close overlay' },
  ]

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center"
      onClick={onClose}
    >
      <div className="fixed inset-0" style={{ background: 'var(--overlay-bg)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }} />
      <div
        className="glass rounded-2xl p-5 relative max-w-xs w-full animate-fade-in"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-label="Keyboard shortcuts"
      >
        <h3 className="text-sm font-medium mb-3">Keyboard Shortcuts</h3>
        <div className="space-y-2">
          {shortcuts.map(({ keys, desc }) => (
            <div key={desc} className="flex items-center justify-between gap-3">
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{desc}</span>
              <div className="flex items-center gap-1">
                {keys.map(k => (
                  <span key={k} className="kbd">{k}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
