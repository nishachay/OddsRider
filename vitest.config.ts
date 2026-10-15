import { defineConfig } from 'vitest/config';

// Unit tests for pure logic only (no DOM, no network, no Phaser).
// Phase 1 will move the track generator into packages/core; the include list
// already covers it so tests move with the code.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'packages/**/*.test.ts'],
    environment: 'node',
    reporters: ['default'],
  },
});
