import '@testing-library/jest-dom'

// Mock IntersectionObserver (not available in jsdom)
class MockIntersectionObserver {
  constructor(callback) {
    this.callback = callback
    this.elements = []
  }
  observe(el) {
    this.elements.push(el)
    // Immediately trigger as intersecting so scroll-reveal elements appear
    this.callback([{ isIntersecting: true, target: el }], this)
  }
  unobserve() {}
  disconnect() {}
}

global.IntersectionObserver = MockIntersectionObserver

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
})
