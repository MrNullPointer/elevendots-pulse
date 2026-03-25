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

// Mock MutationObserver
global.MutationObserver = class {
  constructor() {}
  observe() {}
  disconnect() {}
  takeRecords() { return [] }
}

// Mock Canvas 2D context (NeuralBackground uses Canvas)
HTMLCanvasElement.prototype.getContext = function() {
  return {
    fillRect: () => {},
    clearRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    fill: () => {},
    stroke: () => {},
    quadraticCurveTo: () => {},
    createRadialGradient: () => ({ addColorStop: () => {} }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    scale: () => {},
    setTransform: () => {},
    fillText: () => {},
    measureText: () => ({ width: 0 }),
    canvas: this,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
  }
}

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

global.requestAnimationFrame = (callback) => setTimeout(() => callback(Date.now()), 16)
global.cancelAnimationFrame = (id) => clearTimeout(id)
