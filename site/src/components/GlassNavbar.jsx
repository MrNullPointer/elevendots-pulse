import { Search } from 'lucide-react'
import SectionTabs from './SectionTabs'
import ThemeToggle from './ThemeToggle'
import NavLogo from './NavLogo'

export default function GlassNavbar({ sections, activeSection, onSearchOpen }) {
  return (
    <header
      className="glass sticky top-0 z-50 px-5 py-3 animate-nav"
      role="banner"
    >
      <div className="flex items-center justify-between gap-4">
        <NavLogo accentColor="var(--accent-current)" />

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
