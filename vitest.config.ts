import { defineConfig, configDefaults } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: { '@': resolve(process.cwd(), './src') },
  },
  test: {
    environment: 'node',
    // Never scan git worktrees checked out under .claude/ — they carry their own copies of every test.
    exclude: [...configDefaults.exclude, '.claude/**'],
  },
});
