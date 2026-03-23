import { useState } from 'react'
import { ChevronDown, ChevronUp, Clock } from 'lucide-react'
import { ScrollReveal } from '../hooks/useScrollReveal'

function StatusDot({ status, articlesFound }) {
  let color
  if (status === 'error') color = '#ef4444'
  else if (!articlesFound || articlesFound === 0) color = '#eab308'
  else color = '#22c55e'
  return (
    <span className="w-1.5 h-1.5 rounded-full inline-block shrink-0" style={{ background: color }}
      aria-label={color === '#22c55e' ? 'Healthy' : color === '#eab308' ? 'Empty' : 'Error'} />
  )
}

function formatCrawlTime(timestamp) {
  if (!timestamp) return 'never'
  const diff = (Date.now() - new Date(timestamp).getTime()) / 3600000
  if (diff < 1) return `${Math.round(diff * 60)}m ago`
  if (diff < 24) return `${Math.round(diff)}h ago`
  return `${Math.round(diff / 24)}d ago`
}

export default function SourceHealth({ sources }) {
  const [open, setOpen] = useState(false)
  if (!sources || sources.length === 0) return null

  const healthy = sources.filter(s => s.articles_found > 0).length
  const empty = sources.filter(s => (!s.articles_found || s.articles_found === 0) && s.status !== 'error').length
  const errored = sources.filter(s => s.status === 'error').length

  return (
    <ScrollReveal as="section" className="mb-6">
      <button
        onClick={() => setOpen(o => !o)}
        className="glass-light rounded-xl px-4 py-2.5 w-full flex items-center justify-between transition-all active:scale-[0.99]"
        style={{ transitionTimingFunction: 'var(--spring)' }}
        aria-expanded={open} aria-label="Source health dashboard"
      >
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium">Source Health</span>
          <div className="flex items-center gap-2" style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ background: '#22c55e' }} />{healthy}</span>
            {empty > 0 && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ background: '#eab308' }} />{empty}</span>}
            {errored > 0 && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ background: '#ef4444' }} />{errored}</span>}
          </div>
        </div>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && (
        <div className="glass-subtle rounded-xl mt-1.5 p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1 animate-fade-in">
          {sources.sort((a, b) => (b.articles_found || 0) - (a.articles_found || 0)).map((src, i) => (
            <div key={i} className="flex items-center gap-2 py-1.5" style={{ fontSize: '11px' }}>
              <StatusDot status={src.status} articlesFound={src.articles_found} />
              <span className="font-medium truncate flex-1" style={{ color: 'var(--text-secondary)' }}>{src.name}</span>
              <span className="font-mono opacity-50 shrink-0" style={{ fontSize: '9px' }}>{src.articles_found || 0}</span>
              <span className="flex items-center gap-0.5 opacity-40 shrink-0" style={{ fontSize: '9px' }}>
                <Clock size={8} />{formatCrawlTime(src.last_crawled)}
              </span>
            </div>
          ))}
        </div>
      )}
    </ScrollReveal>
  )
}
