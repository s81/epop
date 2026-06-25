import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  webpack(config) {
    config.watchOptions = {
      ...config.watchOptions,
      // Prevent SQLite WAL/SHM files and test artefacts from triggering HMR rebuilds.
      ignored: ['**/node_modules/**', '**/*.db', '**/*.db-wal', '**/*.db-shm', '**/.playwright-mcp/**'],
    };
    return config;
  },
};

export default nextConfig;
