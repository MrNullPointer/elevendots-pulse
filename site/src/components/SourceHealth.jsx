import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

function StatusDot({ status }) {
  const colors = {
    ok: '#22c55e',
    empty: '#eab308',
    error: '#ef4444',
  }
  return (
    <span
      className="w-1.5 h-1.5 rounded-full inline-block shrink-0"
      style={{ background: colors[status] || colors.empty }}
    />
  )
}

export default function SourceHealth({ sources }) {
  const [open, setOpen] = useState(false)

  if (!sources || sources.length === 0) return null

  return (
    <section className="mb-6">
      <button
        onClick={() => setOpen(o => !o)}
        className="glass-light rounded-xl px-4 py-2.5 w-full flex items-center justify-between transition-all"
        style={{ transitionTimingFunction: 'var(--spring)' }}
      >
        <span className="text-xs font-medium">
          Source Health
          <span className="font-mono opacity-50 ml-1.5" style={{ fontSize: '9px' }}>
            {sources.length} sources
          </span>
        </span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="glass-subtle rounded-xl mt-1.5 p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1.5">
          {sources
            .sort((a, b) => (b.articles_found || 0) - (a.articles_found || 0))
            .map((src, i) => (
            <div key={i} className="flex items-center gap-2 py-1" style={{ fontSize: '11px' }}>
              <StatusDot status={src.status} />
              <span className="font-medium truncate" style={{ color: 'var(--text-secondary)' }}>
                {src.name}
              </span>
              <span className="font-mono opacity-50 ml-auto shrink-0" style={{ fontSize: '9px' }}>
                {src.articles_found || 0}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
