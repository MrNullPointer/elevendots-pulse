import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import StartupReveal from '../components/StartupReveal'

describe('StartupReveal', () => {
  it('renders fragments in the full-motion path', () => {
    render(
      <StartupReveal
        phase="intro"
        theme="dark"
        dataReady={false}
        reduceMotion={false}
        onRevealComplete={() => {}}
      />
    )

    expect(screen.getByTestId('startup-fragments')).toBeInTheDocument()
  })

  it('omits fragments in reduced-motion mode', () => {
    render(
      <StartupReveal
        phase="intro"
        theme="light"
        dataReady={false}
        reduceMotion
        onRevealComplete={() => {}}
      />
    )

    expect(screen.queryByTestId('startup-fragments')).not.toBeInTheDocument()
  })
})
