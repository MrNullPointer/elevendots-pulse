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
    <div className="flex items-center gap-1">
      {OPTIONS.map(opt => (
        <button
          key={opt.value}
          onClick={() => onSelect(opt.value)}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
            active === opt.value
              ? 'glass'
              : 'hover:bg-white/15 opacity-60 hover:opacity-100'
          }`}
          style={{
            transitionTimingFunction: 'var(--spring)',
            fontSize: '11px',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
