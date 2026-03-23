const OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'free', label: 'Free' },
  { value: 'paid', label: 'Paid' },
]

export default function AccessFilter({ active, onSelect }) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Access filter">
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
