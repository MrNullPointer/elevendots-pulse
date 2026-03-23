import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import SectionTabs from './SectionTabs'
import ThemeToggle from './ThemeToggle'

export default function GlassNavbar({ sections, activeSection, onSearchOpen }) {
  const navigate = useNavigate()

  return (
    <header
      className="glass sticky top-0 z-50 px-5 py-3"
      role="banner"
    >
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => navigate('/')}
          className="flex items-center shrink-0"
          style={{ fontSize: '18px', fontWeight: 500, letterSpacing: '-0.3px' }}
          aria-label="Go to homepage"
        >
          <span style={{ color: 'var(--accent-tech)' }}>eleven</span>
          <span style={{ color: 'var(--accent-tech)' }}>.</span>
          <span>dots</span>
          <span style={{ color: 'var(--text-tertiary)' }}>.dev</span>
        </button>

        <div className="hidden md:flex flex-1 justify-center">
          <SectionTabs sections={sections} activeSection={activeSection} />
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={onSearchOpen}
            className="glass-pill rounded-full px-3.5 py-1.5 flex items-center gap-2 text-xs transition-all hover:scale-[1.03]"
            style={{ transitionTimingFunction: 'var(--spring)', color: 'var(--text-tertiary)' }}
            aria-label="Search articles (Cmd+K)"
          >
            <Search size={13} aria-hidden="true" />
            <span className="hidden sm:inline font-mono text-[10px] opacity-50">⌘K</span>
          </button>
          <ThemeToggle />
        </div>
      </div>

      <div className="md:hidden overflow-x-auto mt-2.5">
        <SectionTabs sections={sections} activeSection={activeSection} />
      </div>
    </header>
  )
}
