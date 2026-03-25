import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import StartupReveal from '../components/StartupReveal'

describe('StartupReveal', () => {
  it('renders the overlay with correct phase attribute', () => {
    render(
      <StartupReveal
        phase="intro"
        theme="dark"
        dataReady={false}
        reduceMotion={false}
        onRevealComplete={() => {}}
      />
    )

    const overlay = screen.getByTestId('startup-reveal')
    expect(overlay).toBeInTheDocument()
    expect(overlay).toHaveAttribute('data-phase', 'intro')
    expect(overlay).toHaveAttribute('aria-hidden', 'true')
  })

  it('applies light theme class', () => {
    render(
      <StartupReveal
        phase="intro"
        theme="light"
        dataReady={false}
        reduceMotion={false}
        onRevealComplete={() => {}}
      />
    )

    expect(screen.getByTestId('startup-reveal').className).toContain('startup-reveal--light')
  })

  it('applies reduced-motion class', () => {
    render(
      <StartupReveal
        phase="intro"
        theme="dark"
        dataReady={false}
        reduceMotion
        onRevealComplete={() => {}}
      />
    )

    expect(screen.getByTestId('startup-reveal').className).toContain('startup-reveal--reduced')
  })
})
