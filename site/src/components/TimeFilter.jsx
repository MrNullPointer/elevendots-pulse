const OPTIONS = [
  { value: '1', label: '1h' },
  { value: '6', label: '6h' },
  { value: '12', label: '12h' },
  { value: '24', label: '24h' },
  { value: '48', label: '48h' },
  { value: 'all', label: 'All' },
]

export default function TimeFilter({ active, onSelect }) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Time filter">
      {OPTIONS.map(opt => (
        <button
          key={opt.value}
          onClick={() => onSelect(opt.value)}
          role="radio"
          aria-checked={active === opt.value}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
            active === opt.value ? 'glass-pill' : ''
          }`}
          style={{
            transitionTimingFunction: 'var(--spring)',
            fontSize: '11px',
            opacity: active === opt.value ? 1 : 0.55,
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '1' }}
          onMouseLeave={e => { e.currentTarget.style.opacity = active === opt.value ? '1' : '0.55' }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
