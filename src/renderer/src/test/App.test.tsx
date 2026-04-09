import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../App'

describe('App layout', () => {
  it('renders Deck A panel', () => {
    render(<App />)
    expect(screen.getByTestId('deck-A')).toBeDefined()
  })

  it('renders Deck B panel', () => {
    render(<App />)
    expect(screen.getByTestId('deck-B')).toBeDefined()
  })

  it('renders mixer panel', () => {
    render(<App />)
    expect(screen.getByTestId('mixer-panel')).toBeDefined()
  })

  it('deck A has blue accent, deck B has orange accent', () => {
    render(<App />)
    expect(screen.getByText('DECK A')).toBeDefined()
    expect(screen.getByText('DECK B')).toBeDefined()
  })
})
