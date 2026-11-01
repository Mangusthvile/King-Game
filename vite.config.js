import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    // Tests cover the rules engine only (see CLAUDE.md).
    include: ['tests/**/*.test.js'],
    // Stage 0 has no rules yet, so an empty test run is not a failure.
    passWithNoTests: true,
  },
});
