// Runs before every test file (see vitest.config.ts `setupFiles`).
// jest-dom matchers (toBeInTheDocument, etc.) for component tests; harmless for node tests.
import '@testing-library/jest-dom/vitest';

// React Testing Library auto-cleans the DOM between tests when `globals: true` is set
// (afterEach is available globally), so no manual cleanup() is needed here.
