import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: {
      'core/index': 'src/core/index.ts',
      'react/index': 'src/react/index.ts',
      'mui/index': 'src/mui/index.ts',
      'vite/index': 'src/vite/index.ts',
    },
    format: ['esm'],
    dts: true,
    outDir: 'dist',
    external: [
      'react',
      'react-dom',
      '@mui/material',
      '@mui/icons-material',
      '@emotion/react',
      '@emotion/styled',
      'vite',
    ],
    clean: true,
    splitting: false,
  },
  {
    entry: { 'cli/generate-version-json': 'src/cli/generate-version-json.ts' },
    format: ['esm'],
    outDir: 'dist',
    external: ['node:fs', 'node:path', 'node:child_process'],
    banner: { js: '#!/usr/bin/env node' },
    splitting: false,
  },
]);
