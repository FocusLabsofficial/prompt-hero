// Global test setup for Vitest
import { vi } from 'vitest';

// Mock global objects that are commonly used in tests
global.fetch = vi.fn();

// Mock localStorage
global.localStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

// Mock sessionStorage
global.sessionStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

// Mock console methods to avoid test output noise
global.console = {
  ...console,
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
};

// Mock performance API
global.performance = {
  now: vi.fn(() => Date.now()),
  mark: vi.fn(),
  measure: vi.fn(),
  getEntriesByType: vi.fn(() => []),
  getEntriesByName: vi.fn(() => []),
  clearMarks: vi.fn(),
  clearMeasures: vi.fn(),
};

// Mock URL and URLSearchParams
global.URL = class URL {
  constructor(url, base) {
    this.href = url;
    this.origin = 'http://localhost';
    this.protocol = 'http:';
    this.host = 'localhost';
    this.hostname = 'localhost';
    this.port = '';
    this.pathname = '/';
    this.search = '';
    this.hash = '';
  }
};

global.URLSearchParams = class URLSearchParams {
  constructor(init) {
    this.params = new Map();
    if (init) {
      if (typeof init === 'string') {
        init.split('&').forEach(pair => {
          const [key, value] = pair.split('=');
          if (key) this.params.set(key, value || '');
        });
      } else if (Array.isArray(init)) {
        init.forEach(([key, value]) => this.params.set(key, value));
      } else if (init && typeof init === 'object') {
        Object.entries(init).forEach(([key, value]) => this.params.set(key, value));
      }
    }
  }
  
  get(name) {
    return this.params.get(name);
  }
  
  set(name, value) {
    this.params.set(name, value);
  }
  
  has(name) {
    return this.params.has(name);
  }
  
  delete(name) {
    this.params.delete(name);
  }
  
  toString() {
    return Array.from(this.params.entries())
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
  }
};

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor(callback, options) {
    this.callback = callback;
    this.options = options;
  }
  
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor(callback) {
    this.callback = callback;
  }
  
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock MutationObserver
global.MutationObserver = class MutationObserver {
  constructor(callback) {
    this.callback = callback;
  }
  
  observe() {}
  disconnect() {}
  takeRecords() { return []; }
};

// Mock crypto for UUID generation
global.crypto = {
  randomUUID: vi.fn(() => 'mock-uuid-' + Math.random().toString(36).substr(2, 9)),
  getRandomValues: vi.fn((arr) => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  })
};

// Mock matchMedia for responsive design tests
global.matchMedia = vi.fn((query) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

// Mock scrollTo
global.scrollTo = vi.fn();

// Mock getComputedStyle
global.getComputedStyle = vi.fn(() => ({
  getPropertyValue: vi.fn(() => ''),
}));

// Mock requestAnimationFrame and cancelAnimationFrame
global.requestAnimationFrame = vi.fn((callback) => {
  return setTimeout(callback, 16);
});

global.cancelAnimationFrame = vi.fn((id) => {
  clearTimeout(id);
});

// Mock setTimeout and setInterval with fake timers
global.setTimeout = vi.fn((callback, delay) => {
  return setTimeout(callback, delay);
});

global.setInterval = vi.fn((callback, delay) => {
  return setInterval(callback, delay);
});

global.clearTimeout = vi.fn((id) => {
  clearTimeout(id);
});

global.clearInterval = vi.fn((id) => {
  clearInterval(id);
});

// Mock addEventListener and removeEventListener
const originalAddEventListener = global.addEventListener;
const originalRemoveEventListener = global.removeEventListener;

global.addEventListener = vi.fn((event, handler, options) => {
  if (originalAddEventListener) {
    originalAddEventListener(event, handler, options);
  }
});

global.removeEventListener = vi.fn((event, handler, options) => {
  if (originalRemoveEventListener) {
    originalRemoveEventListener(event, handler, options);
  }
});

// Mock document methods
if (typeof document !== 'undefined') {
  document.addEventListener = vi.fn();
  document.removeEventListener = vi.fn();
  document.querySelector = vi.fn();
  document.querySelectorAll = vi.fn(() => []);
  document.getElementById = vi.fn();
  document.getElementsByClassName = vi.fn(() => []);
  document.getElementsByTagName = vi.fn(() => []);
  document.createElement = vi.fn((tagName) => {
    const element = {
      tagName: tagName.toUpperCase(),
      className: '',
      id: '',
      textContent: '',
      innerHTML: '',
      style: {},
      dataset: {},
      attributes: {},
      children: [],
      parentNode: null,
      appendChild: vi.fn(),
      removeChild: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      focus: vi.fn(),
      blur: vi.fn(),
      click: vi.fn(),
      setAttribute: vi.fn((name, value) => {
        element.attributes[name] = value;
      }),
      getAttribute: vi.fn((name) => element.attributes[name]),
      removeAttribute: vi.fn((name) => {
        delete element.attributes[name];
      }),
      querySelector: vi.fn(),
      querySelectorAll: vi.fn(() => []),
    };
    return element;
  });
}

// Mock window methods
if (typeof window !== 'undefined') {
  window.addEventListener = vi.fn();
  window.removeEventListener = vi.fn();
  window.scrollTo = vi.fn();
  window.scrollBy = vi.fn();
  window.alert = vi.fn();
  window.confirm = vi.fn(() => true);
  window.prompt = vi.fn(() => '');
  window.open = vi.fn();
  window.close = vi.fn();
  window.focus = vi.fn();
  window.blur = vi.fn();
  window.print = vi.fn();
  window.stop = vi.fn();
  window.history = {
    back: vi.fn(),
    forward: vi.fn(),
    go: vi.fn(),
    pushState: vi.fn(),
    replaceState: vi.fn(),
    length: 1,
    state: null,
  };
  window.location = {
    href: 'http://localhost/',
    origin: 'http://localhost',
    protocol: 'http:',
    host: 'localhost',
    hostname: 'localhost',
    port: '',
    pathname: '/',
    search: '',
    hash: '',
    assign: vi.fn(),
    replace: vi.fn(),
    reload: vi.fn(),
  };
}

// Setup global test utilities
global.testUtils = {
  // Helper to create mock DOM elements
  createMockElement: (tagName, attributes = {}) => {
    const element = document.createElement(tagName);
    Object.entries(attributes).forEach(([key, value]) => {
      if (key === 'textContent') {
        element.textContent = value;
      } else if (key === 'innerHTML') {
        element.innerHTML = value;
      } else if (key === 'className') {
        element.className = value;
      } else if (key === 'id') {
        element.id = value;
      } else if (key === 'dataset') {
        Object.entries(value).forEach(([dataKey, dataValue]) => {
          element.dataset[dataKey] = dataValue;
        });
      } else {
        element.setAttribute(key, value);
      }
    });
    return element;
  },
  
  // Helper to create mock events
  createMockEvent: (type, options = {}) => {
    return {
      type,
      target: options.target || null,
      currentTarget: options.currentTarget || null,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      stopImmediatePropagation: vi.fn(),
      ...options
    };
  },
  
  // Helper to wait for async operations
  waitFor: (ms = 0) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Helper to flush promises
  flushPromises: () => new Promise(resolve => setImmediate(resolve)),
};

// Global test cleanup
afterEach(() => {
  // Clear all mocks after each test
  vi.clearAllMocks();
  
  // Reset localStorage and sessionStorage
  global.localStorage.getItem.mockReturnValue(null);
  global.localStorage.setItem.mockClear();
  global.localStorage.removeItem.mockClear();
  global.localStorage.clear.mockClear();
  
  global.sessionStorage.getItem.mockReturnValue(null);
  global.sessionStorage.setItem.mockClear();
  global.sessionStorage.removeItem.mockClear();
  global.sessionStorage.clear.mockClear();
  
  // Reset fetch mock
  global.fetch.mockClear();
  
  // Reset console mocks
  global.console.log.mockClear();
  global.console.error.mockClear();
  global.console.warn.mockClear();
  global.console.info.mockClear();
  global.console.debug.mockClear();
});
