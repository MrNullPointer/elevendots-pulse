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
    <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar">
      {sections.map(section => {
        const isActive = activeSection === section.id
        return (
          <button
            key={section.id}
            onClick={() => navigate(`/${section.id}`)}
            className={`
              px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap
              transition-all
              ${isActive
                ? 'glass text-current'
                : 'hover:bg-white/20 text-current/70'
              }
            `}
            style={{
              transitionTimingFunction: 'var(--spring)',
              transitionDuration: 'var(--duration-medium)',
              borderColor: isActive ? ACCENT[section.id] : 'transparent',
              borderWidth: '0.5px',
              borderStyle: 'solid',
              ...(isActive && { boxShadow: `0 0 12px ${ACCENT[section.id]}15` }),
            }}
          >
            {section.display_name}
          </button>
        )
      })}
    </nav>
  )
}
