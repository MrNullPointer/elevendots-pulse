import { useNavigate } from 'react-router-dom'

const ACCENT = {
  tech: 'var(--accent-tech)',
  science: 'var(--accent-science)',
  philosophy: 'var(--accent-philosophy)',
  misc: 'var(--accent-misc)',
}

export default function SectionTabs({ sections, activeSection }) {
  const navigate = useNavigate()

  return (
    <nav className="flex items-center gap-1.5 overflow-x-auto no-scrollbar" aria-label="Section navigation">
      {sections.map(section => {
        const isActive = activeSection === section.id
        return (
          <button
            key={section.id}
            onClick={() => navigate(`/${section.id}`)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              isActive ? 'glass-pill' : ''
            }`}
            style={{
              transitionTimingFunction: 'var(--spring)',
              transitionDuration: 'var(--duration-medium)',
              opacity: isActive ? 1 : 0.65,
            }}
            onMouseEnter={e => { if (!isActive) e.currentTarget.style.opacity = '1' }}
            onMouseLeave={e => { if (!isActive) e.currentTarget.style.opacity = '0.65' }}
            aria-current={isActive ? 'page' : undefined}
          >
            {section.display_name}
          </button>
        )
      })}
    </nav>
  )
}
