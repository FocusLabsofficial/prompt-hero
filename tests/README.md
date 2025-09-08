# Prompt Hero Test Suite

This directory contains comprehensive tests for the Prompt Hero application, covering unit tests, integration tests, and end-to-end tests.

## Test Structure

```
tests/
├── api/                    # API endpoint tests
│   ├── prompts.test.js     # Prompts API tests
│   ├── favorites.test.js   # Favorites API tests
│   └── collections.test.js # Collections API tests
├── frontend/               # Frontend component tests
│   ├── prompt-manager.test.js    # Prompt management tests
│   ├── favorites-manager.test.js # Favorites management tests
│   └── error-handler.test.js     # Error handling tests
├── integration/            # Integration tests
│   └── api-integration.test.js   # API integration tests
├── e2e/                    # End-to-end tests
│   └── user-workflow.test.js     # Complete user journey tests
└── README.md               # This file
```

## Running Tests

### Prerequisites

Make sure you have the following installed:
- Node.js (v18 or higher)
- npm or yarn

### Installation

```bash
# Install test dependencies
npm install --save-dev vitest @vitest/ui jsdom node-mocks-http

# Or with yarn
yarn add -D vitest @vitest/ui jsdom node-mocks-http
```

### Running All Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui
```

### Running Specific Test Suites

```bash
# Run only API tests
npm test tests/api/

# Run only frontend tests
npm test tests/frontend/

# Run only integration tests
npm test tests/integration/

# Run only E2E tests
npm test tests/e2e/

# Run specific test file
npm test tests/api/prompts.test.js
```

## Test Categories

### 1. API Tests (`tests/api/`)

Tests for Vercel serverless API endpoints:

- **prompts.test.js**: Tests for `/api/prompts` endpoints
  - GET /api/prompts (list prompts with filtering, pagination, sorting)
  - POST /api/prompts (create new prompt)
  - GET /api/prompts/[id] (get specific prompt)
  - PUT /api/prompts/[id] (update prompt)
  - DELETE /api/prompts/[id] (delete prompt)

- **favorites.test.js**: Tests for `/api/favorites` endpoints
  - GET /api/favorites (get user favorites)
  - POST /api/favorites (add to favorites)
  - DELETE /api/favorites/[id] (remove from favorites)

- **collections.test.js**: Tests for `/api/collections` endpoints
  - GET /api/collections (get user collections)
  - POST /api/collections (create collection)
  - PUT /api/collections/[id] (update collection)
  - DELETE /api/collections/[id] (delete collection)

### 2. Frontend Tests (`tests/frontend/`)

Tests for client-side JavaScript modules:

- **prompt-manager.test.js**: Tests for prompt management functionality
  - Prompt loading and rendering
  - Search and filtering
  - Card creation and display
  - Rating system
  - HTML escaping and security

- **favorites-manager.test.js**: Tests for favorites and collections management
  - Favorites CRUD operations
  - Collections CRUD operations
  - UI updates and persistence
  - Event handling
  - Data validation

- **error-handler.test.js**: Tests for error handling and notifications
  - Success, error, warning, and info notifications
  - Notification stack management
  - Auto-dismissal timers
  - HTML escaping
  - Error logging

### 3. Integration Tests (`tests/integration/`)

Tests for API integration and middleware:

- **api-integration.test.js**: Comprehensive API integration tests
  - End-to-end API workflows
  - Middleware integration
  - Security measures
  - Error handling
  - Database interactions

### 4. End-to-End Tests (`tests/e2e/`)

Tests for complete user workflows:

- **user-workflow.test.js**: Complete user journey tests
  - Discover and rate prompts
  - Create and manage collections
  - Advanced search and filtering
  - Error handling and recovery
  - Mobile responsive interactions
  - Performance with large datasets
  - Data persistence across sessions
  - Accessibility features

## Test Configuration

### Vitest Configuration

Create a `vitest.config.js` file in the project root:

```javascript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.test.js',
        '**/*.spec.js'
      ]
    }
  }
});
```

### Test Setup

Create a `tests/setup.js` file for global test setup:

```javascript
// Global test setup
import { vi } from 'vitest';

// Mock global objects
global.fetch = vi.fn();
global.localStorage = {
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
};
```

## Test Data

### Mock Data

Tests use mock data to ensure consistent and predictable results:

- **Prompts**: Sample prompt data with various categories, ratings, and metadata
- **Users**: Mock user data for authentication and authorization tests
- **Collections**: Sample collection data for testing collection management
- **Ratings**: Mock rating data for testing the rating system

### Database Mocking

Database operations are mocked using:
- `@vercel/postgres` mock for API tests
- In-memory storage for frontend tests
- Mock data for integration tests

## Best Practices

### Writing Tests

1. **Descriptive Test Names**: Use clear, descriptive test names that explain what is being tested
2. **Arrange-Act-Assert**: Structure tests with clear setup, execution, and verification phases
3. **Mock External Dependencies**: Mock API calls, database operations, and external services
4. **Test Edge Cases**: Include tests for error conditions, empty data, and boundary cases
5. **Clean Up**: Reset mocks and state between tests

### Test Organization

1. **Group Related Tests**: Use `describe` blocks to group related tests
2. **Use Setup and Teardown**: Use `beforeEach` and `afterEach` for common setup
3. **Test One Thing**: Each test should verify one specific behavior
4. **Independent Tests**: Tests should not depend on each other

### Performance

1. **Mock Heavy Operations**: Mock database queries and API calls
2. **Use Fake Timers**: Use `vi.useFakeTimers()` for time-dependent tests
3. **Clean Up Resources**: Properly clean up timers, intervals, and event listeners
4. **Parallel Execution**: Tests should be able to run in parallel

## Continuous Integration

### GitHub Actions

Add a `.github/workflows/test.yml` file:

```yaml
name: Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run tests
      run: npm test
    
    - name: Run tests with coverage
      run: npm run test:coverage
    
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
```

## Debugging Tests

### Common Issues

1. **Async/Await**: Make sure to properly handle async operations in tests
2. **Mock Cleanup**: Reset mocks between tests to avoid interference
3. **DOM Manipulation**: Use proper DOM setup for frontend tests
4. **Timing Issues**: Use fake timers for time-dependent tests

### Debug Commands

```bash
# Run tests with verbose output
npm test -- --reporter=verbose

# Run specific test with debug output
npm test -- --reporter=verbose tests/api/prompts.test.js

# Run tests in debug mode
node --inspect-brk node_modules/.bin/vitest
```

## Coverage Reports

### Coverage Configuration

The test suite includes comprehensive coverage reporting:

- **Statements**: 90%+ coverage target
- **Branches**: 85%+ coverage target
- **Functions**: 90%+ coverage target
- **Lines**: 90%+ coverage target

### Viewing Coverage

```bash
# Generate coverage report
npm run test:coverage

# Open coverage report in browser
open coverage/index.html
```

## Contributing

When adding new tests:

1. Follow the existing test structure and naming conventions
2. Add tests for new features and bug fixes
3. Update this README if adding new test categories
4. Ensure all tests pass before submitting PRs
5. Maintain or improve test coverage

## Troubleshooting

### Common Problems

1. **Import Errors**: Make sure all imports are correct and modules exist
2. **Mock Issues**: Verify mocks are properly set up and reset between tests
3. **DOM Errors**: Ensure proper DOM setup for frontend tests
4. **Async Issues**: Use proper async/await patterns in tests

### Getting Help

If you encounter issues with the test suite:

1. Check the test logs for specific error messages
2. Verify all dependencies are installed
3. Ensure the test environment is properly configured
4. Check for any recent changes that might affect tests
